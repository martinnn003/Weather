// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../App.jsx";
import { SettingsProvider } from "../settings.jsx";

// A ten-day forecast shaped exactly like Open-Meteo's, generated instead of stored
// so the fixture stays readable. The run starts on 26 July and rolls over into
// August, which is why the dates are counted rather than written out: "2026-07-32"
// is what naive counting produces, and it is not a date.
const days = Array.from({ length: 10 }, (_, i) =>
  new Date(Date.UTC(2026, 6, 26 + i)).toISOString().slice(0, 10));
const hourCount = days.length * 24;

const forecast = {
  current: {
    time: "2026-07-26T18:30", temperature_2m: 25.5, weather_code: 0, relative_humidity_2m: 61,
    apparent_temperature: 26.2, wind_speed_10m: 12.4, wind_direction_10m: 132,
    surface_pressure: 1012.8, precipitation: 0, is_day: 1
  },
  daily: {
    time: days,
    weather_code: days.map((_, i) => (i === 3 ? 63 : 0)),
    temperature_2m_max: days.map((_, i) => 28 + i),
    temperature_2m_min: days.map((_, i) => 18 + i),
    apparent_temperature_max: days.map((_, i) => 30 + i),
    wind_speed_10m_max: days.map(() => 22),
    sunrise: days.map(d => `${d}T06:05`),
    sunset: days.map(d => `${d}T20:45`),
    uv_index_max: days.map(() => 7.4),
    precipitation_probability_max: days.map(() => 20),
    precipitation_sum: days.map(() => 1.2)
  },
  hourly: {
    time: Array.from({ length: hourCount }, (_, i) =>
      `${days[Math.floor(i / 24)]}T${String(i % 24).padStart(2, "0")}:00`),
    temperature_2m: Array.from({ length: hourCount }, (_, i) => 15 + (i % 24) / 2),
    weather_code: Array.from({ length: hourCount }, () => 0),
    precipitation_probability: Array.from({ length: hourCount }, () => 10),
    visibility: Array.from({ length: hourCount }, () => 24140),
    is_day: Array.from({ length: hourCount }, (_, i) => ((i % 24) >= 6 && (i % 24) < 21 ? 1 : 0))
  }
};

const respond = body => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

// A test that needs a different answer overrides this; `beforeEach` puts it back,
// since clearing a mock forgets its calls but keeps whatever implementation it was given.
const defaultFetch = url => {
  if (url.includes("/v1/forecast")) return respond(forecast);
  if (url.includes("air-quality")) return respond({ current: { european_aqi: 40 } });
  if (url.includes("/v1/get")) {
    const place = { id: 728193, latitude: 42.15, longitude: 24.75 };
    return respond(url.includes("language=bg")
      ? { ...place, name: "Пловдив", country: "България" }
      : { ...place, name: "Plovdiv", country: "Bulgaria" });
  }
  if (url.includes("/v1/search")) {
    return respond({ results: [{ id: 728193, name: "Plovdiv", country: "Bulgaria", admin1: "Plovdiv", latitude: 42.15, longitude: 24.75 }] });
  }
  throw new Error(`unexpected request: ${url}`);
};

const fetchStub = vi.fn(defaultFetch);

const show = () => render(<SettingsProvider><App /></SettingsProvider>);

// jsdom has no geolocation at all, so it is added rather than replaced.
const stubGeolocation = () => {
  const getCurrentPosition = vi.fn(onOk =>
    onOk({ coords: { latitude: 42.15, longitude: 24.75 } }));
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition }
  });
  return getCurrentPosition;
};

beforeEach(() => {
  fetchStub.mockImplementation(defaultFetch);
  vi.stubGlobal("fetch", fetchStub);
  localStorage.clear();
  history.replaceState(null, "", "/");
  Object.defineProperty(navigator, "language", { value: "bg-BG", configurable: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("the app", () => {
  it("shows the placeholder first, then the forecast", async () => {
    show();
    expect(screen.getByRole("status", { name: "Зареждане на прогнозата" })).toBeTruthy();
    expect(await screen.findByText("София, България")).toBeTruthy();
    expect(screen.getByText("26°C")).toBeTruthy();
    expect(screen.getAllByRole("button", { pressed: false }).length).toBeGreaterThan(0);
  });

  it("names the first two days and lists ten", async () => {
    show();
    await screen.findByText("София, България");
    const forecastPanel = screen.getByRole("region", { name: "Прогноза за 10 дни" });
    expect(within(forecastPanel).getAllByRole("button")).toHaveLength(10);
    expect(within(forecastPanel).getByText("Днес")).toBeTruthy();
    expect(within(forecastPanel).getByText("Утре")).toBeTruthy();
  });

  it("dates every day, so the repeated weekday names stay apart", async () => {
    show();
    await screen.findByText("София, България");
    const forecastPanel = screen.getByRole("region", { name: "Прогноза за 10 дни" });
    // 26 July … 4 August: the tenth card rolls over into the next month.
    expect(within(forecastPanel).getByText("26 юли")).toBeTruthy();
    expect(within(forecastPanel).getByText("4 авг")).toBeTruthy();
    // 28 July and 4 August are both Tuesdays: only the date tells them apart.
    expect(within(forecastPanel).getAllByText("вт")).toHaveLength(2);
    expect(within(forecastPanel).getByText("28 юли")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Днес, 26 юли:/ })).toBeTruthy();
  });

  it("shows live readings for today, including wind direction and air quality", async () => {
    show();
    await screen.findByText("София, България");
    expect(screen.getByText("Вятър · ЮИ ↖")).toBeTruthy();
    expect(screen.getByText("Въздух · Задоволително")).toBeTruthy();
    expect(screen.getByText("1013 hPa")).toBeTruthy();
    expect(screen.getByText("24 km")).toBeTruthy();
  });

  it("opens the hourly strip from the current hour for today", async () => {
    show();
    await screen.findByText("София, България");
    fireEvent.click(screen.getByRole("button", { name: /^Днес/ }));
    const strip = await screen.findByRole("region", { name: "Почасова прогноза" });
    expect(within(strip).getByText("18:00")).toBeTruthy();
    expect(within(strip).queryByText("00:00")).toBeNull();
    expect(strip.querySelector("svg path")).toBeTruthy(); // the temperature curve
  });

  it("turns the panel into a day summary when a future day is picked", async () => {
    show();
    await screen.findByText("София, България");
    const forecastPanel = screen.getByRole("region", { name: "Прогноза за 10 дни" });
    fireEvent.click(within(forecastPanel).getAllByRole("button")[3]);

    expect(await screen.findByText("сряда, 29 юли")).toBeTruthy();
    expect(screen.getByText("Макс.")).toBeTruthy();
    expect(screen.getByText("Количество")).toBeTruthy();
    expect(screen.queryByText("Влажност")).toBeNull();
    const strip = screen.getByRole("region", { name: "Почасова прогноза" });
    expect(within(strip).getAllByText(/^\d\d:00$/)).toHaveLength(24);

    fireEvent.click(within(forecastPanel).getAllByRole("button")[3]); // deselect
    expect(await screen.findByText("Прогноза за времето за 10 дни")).toBeTruthy();
  });

  it("switches units", async () => {
    show();
    await screen.findByText("София, България");
    fireEvent.click(screen.getByRole("button", { name: "°F" }));
    expect(await screen.findByText("78°F")).toBeTruthy();
    expect(screen.getByText("29.91 inHg")).toBeTruthy();
  });

  it("translates the whole interface, including the city name", async () => {
    show();
    await screen.findByText("София, България");
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(await screen.findByText("Sofia, Bulgaria")).toBeTruthy();
    expect(screen.getByText("10-Day Weather Forecast")).toBeTruthy();
    expect(screen.getByText("Pressure")).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");
  });

  it("returns to the home city when the brand is clicked", async () => {
    show();
    await screen.findByText("София, България");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Plovdiv" } });
    fireEvent.click(await screen.findByRole("option", { name: /Plovdiv/ }, { timeout: 2000 }));
    await screen.findByText("Пловдив, България");

    const brand = screen.getByRole("link", { name: "MeteoDita — начало" });
    expect(brand.getAttribute("href")).toBe("./"); // openable in a tab, not a bare button
    fireEvent.click(brand);
    expect(await screen.findByText("София, България")).toBeTruthy();
  });

  it("asks for no permission on the way home", async () => {
    const getCurrentPosition = stubGeolocation();
    show();
    await screen.findByText("София, България");

    fireEvent.click(screen.getByRole("link", { name: "MeteoDita — начало" }));
    expect(getCurrentPosition).not.toHaveBeenCalled(); // a logo is not a location prompt
    fireEvent.click(screen.getByRole("button", { name: "Моето местоположение" }));
    expect(getCurrentPosition).toHaveBeenCalled();
  });

  it("leaves a modified click to the browser, so the brand opens in a new tab", async () => {
    show();
    await screen.findByText("София, България");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Plovdiv" } });
    fireEvent.click(await screen.findByRole("option", { name: /Plovdiv/ }, { timeout: 2000 }));
    await screen.findByText("Пловдив, България");

    fireEvent.click(screen.getByRole("link", { name: "MeteoDita — начало" }), { ctrlKey: true });
    expect(screen.getByText("Пловдив, България")).toBeTruthy(); // this tab stayed put
  });

  it("searches, then re-translates the found city when the language changes", async () => {
    show();
    await screen.findByText("София, България");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Plovdiv" } });
    const option = await screen.findByRole("option", { name: /Plovdiv/ }, { timeout: 2000 });
    fireEvent.click(option);

    expect(await screen.findByText("Пловдив, България")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(await screen.findByText("Plovdiv, Bulgaria")).toBeTruthy();
  });

  it("loads the typed city on Enter, without a trip through the list", async () => {
    show();
    await screen.findByText("София, България");

    const box = screen.getByRole("combobox");
    fireEvent.change(box, { target: { value: "Plovdiv" } });
    await screen.findByRole("option", { name: /Plovdiv/ }, { timeout: 2000 });
    fireEvent.keyDown(box, { key: "Enter" }); // no ArrowDown first

    expect(await screen.findByText("Пловдив, България")).toBeTruthy();
    expect(box.value).toBe("");
  });

  it("honours an Enter pressed before the results have arrived", async () => {
    show();
    await screen.findByText("София, България");

    const box = screen.getByRole("combobox");
    fireEvent.change(box, { target: { value: "Plovdiv" } });
    fireEvent.keyDown(box, { key: "Enter" }); // the search is still 300 ms away

    expect(await screen.findByText("Пловдив, България", undefined, { timeout: 2000 })).toBeTruthy();
  });

  it("takes the city that was typed over the better-ranked one above it", async () => {
    fetchStub.mockImplementation(url => {
      if (url.includes("/v1/search")) {
        return respond({ results: [
          { id: 111, name: "Plovdivci", country: "Bulgaria", latitude: 41.9, longitude: 26.1 },
          { id: 728193, name: "Plovdiv", country: "Bulgaria", latitude: 42.15, longitude: 24.75 }
        ] });
      }
      if (url.includes("/v1/get")) {
        return respond({ id: 728193, latitude: 42.15, longitude: 24.75, name: "Пловдив", country: "България" });
      }
      if (url.includes("air-quality")) return respond({ current: { european_aqi: 40 } });
      return respond(forecast);
    });
    show();
    await screen.findByText("София, България");

    const box = screen.getByRole("combobox");
    fireEvent.change(box, { target: { value: "Plovdiv" } });
    await screen.findByRole("option", { name: /Plovdivci/ }, { timeout: 2000 });
    fireEvent.keyDown(box, { key: "Enter" });

    await waitFor(() => expect(location.pathname).toBe("/plovdiv-balgariya-728193"));
  });

  it("saves a city to the chip bar and keeps the link shareable", async () => {
    show();
    await screen.findByText("София, България");
    fireEvent.click(screen.getByRole("button", { name: "Запази този град" }));

    const bar = await screen.findByRole("navigation", { name: "Запазени градове" });
    expect(within(bar).getByText("София, България")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("favorites"))).toHaveLength(1);

    fireEvent.click(within(bar).getByRole("button", { name: /Премахни/ }));
    expect(screen.queryByRole("navigation", { name: "Запазени градове" })).toBeNull();
  });

  it("leaves the address bare at home and gives a city one of its own", async () => {
    show();
    await screen.findByText("София, България");
    await waitFor(() => expect(location.search).toBe(""));
    expect(location.pathname).toBe("/");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Plovdiv" } });
    fireEvent.click(await screen.findByRole("option", { name: /Plovdiv/ }, { timeout: 2000 }));
    await screen.findByText("Пловдив, България");

    await waitFor(() => expect(location.pathname).toBe("/plovdiv-balgariya-728193"));
    expect(location.search).toContain("lang=bg");
    expect(location.search).toContain("unit=c");
    expect(location.search).not.toContain("lat="); // the id names the place on its own

    fireEvent.click(screen.getByRole("link", { name: "MeteoDita — начало" }));
    await screen.findByText("София, България");
    await waitFor(() => expect(location.pathname).toBe("/")); // and bare again on the way back
    expect(location.search).toBe("");
  });

  it("starts from a city address, misspelt words and all", async () => {
    history.replaceState(null, "", "/plovidv-bulgaria-728193?lang=bg&unit=f");
    show();
    expect(await screen.findByText("Пловдив, България")).toBeTruthy();
    expect(screen.getByText("78°F")).toBeTruthy();
    await waitFor(() => expect(location.pathname).toBe("/plovdiv-balgariya-728193"));
  });

  it("sends a dead city address home with a word of explanation", async () => {
    fetchStub.mockImplementation(url => (url.includes("/v1/get")
      ? Promise.resolve({ ok: false, status: 404 })
      : respond(forecast)));
    history.replaceState(null, "", "/nowhere-999999999");
    show();
    expect(await screen.findByText(/Този град не беше намерен/)).toBeTruthy();
    expect(await screen.findByText("София, България")).toBeTruthy();
    await waitFor(() => expect(location.pathname).toBe("/"));
  });

  it("still starts from an old query-string link", async () => {
    history.replaceState(null, "", "/?lat=42.15&lon=24.75&city=Plovdiv&id=728193&lang=bg&unit=f");
    show();
    expect(await screen.findByText("Пловдив, България")).toBeTruthy();
    expect(screen.getByText("78°F")).toBeTruthy();
  });

  it("reports a failed load", async () => {
    fetchStub.mockImplementation(url => (url.includes("/v1/forecast")
      ? Promise.resolve({ ok: false, status: 500 })
      : respond({ current: {} })));
    show();
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent", "Данните за времето не можаха да се заредят. Опитай отново по-късно.");
  });
});
