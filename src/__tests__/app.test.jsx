// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../App.jsx";
import { SettingsProvider } from "../settings.jsx";
import { HOUR_W, HOUR_GAP } from "../hours.js";
import { MERGE } from "../merge.js";
import { CODES } from "../weatherCodes.js";

// A ten-day forecast, generated instead of stored so the fixture stays readable. The
// run starts on 26 July and rolls over into August, which is why the dates are counted
// rather than written out: "2026-07-32" is what naive counting produces, and it is not
// a date.
const days = Array.from({ length: 10 }, (_, i) =>
  new Date(Date.UTC(2026, 6, 26 + i)).toISOString().slice(0, 10));
const hourCount = days.length * 24;
const each = make => Array.from({ length: hourCount }, (_, i) => make(i % 24, Math.floor(i / 24)));

// Written once, as the app reads it after merging: every hour of the ten days, and the
// day's figures worked out from them, as the app does. `openMeteo` below turns it into
// the answer Open-Meteo actually sends.
const forecast = {
  current: { time: "2026-07-26T18:30", is_day: 1 },
  daily: {
    time: days,
    sunrise: days.map(d => `${d}T06:05`),
    sunset: days.map(d => `${d}T20:45`)
  },
  hourly: {
    time: each((h, d) => `${days[d]}T${String(h).padStart(2, "0")}:00`),
    // From 18° at midnight to 28° at 23:00, a degree warmer each day, so day i runs from
    // 18+i to 28+i; now, at 18:00 on the first day, it reads 25.8°.
    temperature_2m: each((h, d) => 18 + d + (h * 10) / 23),
    apparent_temperature: each((h, d) => 19 + d + (h * 10) / 23),
    relative_humidity_2m: each(() => 61),
    cloud_cover: each(() => 0),
    cloud_cover_low: each(() => 0),
    wind_gusts_10m: each(() => 41),
    // The models' own codes, consulted only for storms and fog; the icons are built from
    // the rain and the cloud below.
    weather_code: each(() => 0),
    precipitation: each(h => (h >= 14 && h < 18 ? 0.3 : 0)), // a wet afternoon, 1.2 mm a day
    // 20% at two in the afternoon and 10% otherwise, so the day's peak is not the hour's.
    precipitation_probability: each(h => (h === 14 ? 20 : 10)),
    visibility: each(() => 24140),
    // Picks up through the day, so no two hours of a day share a reading: 00:00 is 4, 23:00 is 27.
    wind_speed_10m: each(h => 4 + h),
    wind_direction_10m: each(() => 132),
    pressure_msl: each(() => 1012.8),
    is_day: each(h => (h >= 6 && h < 21 ? 1 : 0))
  }
};

// The app asks for two models at once, and Open-Meteo answers with every hourly series
// twice, suffixed with each model's id. Both get the same readings here, so the merge
// has nothing to choose between and every reading above is the one that reaches the screen.
const openMeteo = ({ current, daily, hourly }) => {
  const twice = (block, names) => Object.fromEntries(names.flatMap(name =>
    [MERGE.icon, MERGE.ecmwf].map(model => [`${name}_${model}`, block[name]])));
  const { time, ...series } = hourly;
  return {
    current,
    daily: { time: daily.time, ...twice(daily, ["sunrise", "sunset"]) },
    hourly: { time, ...twice(hourly, Object.keys(series)) }
  };
};

// CAMS's UV, which the air-quality answer carries: seven days of it, peaking at 7.4 at
// one in the afternoon, and 0.2 now, in the evening. The last three days are past its reach.
const air = {
  current: { european_aqi: 40, uv_index: 0.2 },
  hourly: {
    time: forecast.hourly.time.slice(0, 7 * 24),
    uv_index: each(h => (h === 13 ? 7.4 : h >= 6 && h < 21 ? 2 : 0)).slice(0, 7 * 24)
  }
};

const respond = body => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
const answer = shape => respond(openMeteo(shape));

// A test that needs a different answer overrides this; `beforeEach` puts it back,
// since clearing a mock forgets its calls but keeps whatever implementation it was given.
const defaultFetch = url => {
  if (url.includes("/v1/forecast")) return answer(forecast);
  if (url.includes("air-quality")) return respond(air);
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

  it("gives every day its wind, and says so in words for a screen reader", async () => {
    show();
    await screen.findByText("София, България");
    const forecastPanel = screen.getByRole("region", { name: "Прогноза за 10 дни" });
    // The fixture blows from 132° all ten days: south-east, so the arrow points north-west.
    // The speed is the day's strongest hour, 23:00's.
    expect(within(forecastPanel).getAllByText("↖ 27 км/ч")).toHaveLength(10);
    // The arrow is a glyph a screen reader cannot say, so the label spells the bearing out.
    expect(screen.getByRole("button", { name: /^Днес, 26 юли:.*, вятър ЮИ 27 км\/ч, валежи 1\.2 мм$/ }))
      .toBeTruthy();
  });

  it("leaves the wind out of a day that has none, rather than calling it calm", async () => {
    const windless = { ...forecast, hourly: { ...forecast.hourly, wind_speed_10m: each(() => null) } };
    fetchStub.mockImplementation(url => (url.includes("/v1/forecast")
      ? answer(windless)
      : defaultFetch(url)));
    show();
    await screen.findByText("София, България");
    const forecastPanel = screen.getByRole("region", { name: "Прогноза за 10 дни" });
    // Math.round(null) is 0, which would otherwise print a confident "0 км/ч".
    expect(within(forecastPanel).queryByText(/км\/ч/)).toBeNull();
    expect(screen.getByRole("button", { name: /^Днес, 26 юли:.*мин\. 18°, валежи 1\.2 мм$/ }))
      .toBeTruthy();
  });

  it("gives every day its rainfall as well, in the same block as the wind", async () => {
    show();
    await screen.findByText("София, България");
    const forecastPanel = screen.getByRole("region", { name: "Прогноза за 10 дни" });
    expect(within(forecastPanel).getAllByText("💧 1.2 мм")).toHaveLength(10);
    expect(screen.getByRole("button", { name: /^Днес, 26 юли:.*, валежи 1\.2 мм$/ }))
      .toBeTruthy();
  });

  it("never puts 🌦️ over 0 mm, or ☀️ over 3 mm", async () => {
    // The models' codes say the opposite of the rain: rain all through a dry first day,
    // clear skies over a second that rains a millimetre an hour from 14:00 to 17:00.
    const contrary = {
      ...forecast,
      hourly: {
        ...forecast.hourly,
        weather_code: each((h, d) => (d === 0 ? 61 : 0)),
        precipitation: each((h, d) => (d === 1 && h >= 14 && h < 17 ? 1 : 0))
      }
    };
    fetchStub.mockImplementation(url => (url.includes("/v1/forecast")
      ? answer(contrary)
      : defaultFetch(url)));
    show();
    await screen.findByText("София, България");
    const tiles = within(screen.getByRole("region", { name: "Прогноза за 10 дни" }))
      .getAllByRole("button");
    expect(within(tiles[0]).getByText(CODES[0].icon)).toBeTruthy();
    expect(within(tiles[0]).getByText("💧 0.0 мм")).toBeTruthy();
    expect(within(tiles[1]).getByText(CODES[61].icon)).toBeTruthy();
    expect(within(tiles[1]).getByText("💧 3.0 мм")).toBeTruthy();
  });

  it("prints a dry day's nought, and leaves only a missing total blank", async () => {
    // Nought and nothing are different readings: the first says the day stays dry, the
    // second that no one said. Only the second is allowed to leave the tile empty.
    const dry = {
      ...forecast,
      hourly: { ...forecast.hourly, precipitation: each((h, d) => (d === 0 ? 0 : null)) }
    };
    fetchStub.mockImplementation(url => (url.includes("/v1/forecast")
      ? answer(dry)
      : defaultFetch(url)));
    show();
    await screen.findByText("София, България");
    const forecastPanel = screen.getByRole("region", { name: "Прогноза за 10 дни" });
    expect(within(forecastPanel).getByText("💧 0.0 мм")).toBeTruthy();
    expect(within(forecastPanel).getAllByText(/мм$/)).toHaveLength(1);
  });

  it("shows live readings for today, including wind direction and air quality", async () => {
    show();
    await screen.findByText("София, България");
    expect(screen.getByText("Вятър · ЮИ ↖")).toBeTruthy();
    expect(screen.getByText("Въздух · Задоволително")).toBeTruthy();
    expect(screen.getByText("1013 хПа")).toBeTruthy();
    expect(screen.getByText("24 км")).toBeTruthy();
  });

  it("keeps today's strip whole and fades the hours already gone", async () => {
    show();
    await screen.findByText("София, България");
    fireEvent.click(screen.getByRole("button", { name: /^Днес/ }));
    const strip = await screen.findByRole("region", { name: "Почасова прогноза" });
    const cellFor = time => within(strip).getByText(time).closest("div[title]");
    expect(cellFor("00:00").className).toContain("opacity-45"); // now is 18:30
    expect(cellFor("18:00").className).not.toContain("opacity-45");
    expect(cellFor("23:00")).toBeTruthy();
    expect(strip.querySelector("svg path")).toBeTruthy(); // the temperature curve
  });

  it("gives every hour its own wind speed, so the day can be seen picking up", async () => {
    show();
    await screen.findByText("София, България");
    fireEvent.click(screen.getByRole("button", { name: /^Утре/ }));
    const strip = await screen.findByRole("region", { name: "Почасова прогноза" });
    const cellFor = time => within(strip).getByText(time).closest("div[title]");
    expect(within(cellFor("10:00")).getByText("14 км/ч")).toBeTruthy();
    expect(within(cellFor("15:00")).getByText("19 км/ч")).toBeTruthy();
    expect(cellFor("15:00").title).toContain("19 км/ч");
  });

  it("leaves an hour's wind blank when the forecast has none", async () => {
    const calm = { ...forecast, hourly: { ...forecast.hourly, wind_speed_10m: undefined } };
    fetchStub.mockImplementation(url => (url.includes("/v1/forecast")
      ? answer(calm)
      : defaultFetch(url)));
    show();
    await screen.findByText("София, България");
    fireEvent.click(screen.getByRole("button", { name: /^Утре/ }));
    const strip = await screen.findByRole("region", { name: "Почасова прогноза" });
    expect(within(strip).getAllByText(/^\d\d:00$/)).toHaveLength(24);
    expect(within(strip).queryByText(/км\/ч/)).toBeNull();
  });

  it("re-aims the strip at the new day instead of keeping the last scroll", async () => {
    show();
    await screen.findByText("София, България");
    fireEvent.click(screen.getByRole("button", { name: /^Днес/ }));
    // The panel is the labelled region; the row inside it is what scrolls.
    const strip = await screen.findByRole("region", { name: "Почасова прогноза" });
    expect(strip.querySelector(".scroll-x").scrollLeft).toBe(18 * (HOUR_W + HOUR_GAP)); // now is 18:30

    // The same node is reused across days, so tomorrow must be aimed back at midnight.
    fireEvent.click(screen.getByRole("button", { name: /^Утре/ }));
    await screen.findByText("понеделник, 27 юли");
    expect(screen.getByRole("region", { name: "Почасова прогноза" })
      .querySelector(".scroll-x").scrollLeft).toBe(0);
  });

  it("reads UV and the chance of rain for the moment, with the day's peak in the label", async () => {
    show();
    await screen.findByText("София, България");
    // The peak alone used to stand here, so an evening read UV 7.
    const uv = screen.getByText("UV индекс · макс. 7").parentElement;
    expect(within(uv).getByText("0")).toBeTruthy();
    const rain = screen.getByText("Валежи · макс. 20%").parentElement;
    expect(within(rain).getByText("10%")).toBeTruthy();
  });

  it("leaves UV and the chance of rain out when no one gave a reading", async () => {
    const unknown = {
      ...forecast,
      hourly: { ...forecast.hourly, precipitation_probability: each(() => null) }
    };
    fetchStub.mockImplementation(url => {
      if (url.includes("/v1/forecast")) return answer(unknown);
      if (url.includes("air-quality")) return respond({ current: { european_aqi: 40 } });
      return defaultFetch(url);
    });
    show();
    await screen.findByText("София, България");
    expect(screen.queryByText(/^UV индекс/)).toBeNull();
    expect(screen.queryByText(/^Валежи ·/)).toBeNull();
  });

  it("gives UV to the days the air-quality forecast reaches, and to no others", async () => {
    show();
    await screen.findByText("София, България");
    const forecastPanel = screen.getByRole("region", { name: "Прогноза за 10 дни" });
    fireEvent.click(within(forecastPanel).getAllByRole("button")[6]); // 1 August, the last
    expect(await screen.findByText("UV индекс")).toBeTruthy();
    fireEvent.click(within(forecastPanel).getAllByRole("button")[7]); // 2 August, past it
    await screen.findByText("неделя, 2 август");
    // A 0 here would claim a dark day; nothing is what was forecast.
    expect(screen.queryByText("UV индекс")).toBeNull();
  });

  it("names the models under every day when the address asks for it", async () => {
    history.replaceState(null, "", "/?debug=1");
    show();
    await screen.findByText("София, България");
    const tiles = within(screen.getByRole("region", { name: "Прогноза за 10 дни" }))
      .getAllByRole("button");
    // ICON-EU for four days, the slide into ECMWF on the fifth, ECMWF after; the rain is
    // ECMWF's throughout.
    expect(within(tiles[0]).getByText("T: ICON-EU")).toBeTruthy();
    expect(within(tiles[4]).getByText("T: ICON-EU→IFS")).toBeTruthy();
    expect(within(tiles[9]).getByText("T: IFS")).toBeTruthy();
    expect(within(tiles[0]).getByText("P: IFS")).toBeTruthy();
    // Home rewrites the address to its bare self, and must not drop the flag doing it.
    expect(location.search).toBe("?debug=1");
  });

  it("names no models without the flag", async () => {
    show();
    await screen.findByText("София, България");
    expect(screen.queryByText(/^T: /)).toBeNull();
    // Only the footer's own text is matched, so the linked "Open-Meteo.com" falls out of it.
    expect(screen.getByText(
      /^Данни за времето: · ICON \(DWD\), IFS \(ECMWF\), CAMS \(Copernicus\), CC BY 4\.0$/)).toBeTruthy();
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
    // The units and the footer's lead-in go back to English with the rest.
    expect(screen.getByText("1013 hPa")).toBeTruthy();
    expect(screen.getByText("24 km")).toBeTruthy();
    expect(screen.getAllByText("💧 1.2 mm")).toHaveLength(10);
    expect(screen.getByText(/^Weather data: · ICON/)).toBeTruthy();
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

  // Names come back in the language that was searched, so "Varna" typed under a Bulgarian
  // interface matches nothing at the top — the only result spelt that way is the Russian
  // village, which has no Bulgarian name. Enter takes the row on screen, not the spelling.
  it("takes the top result on Enter, not the one spelt like the query", async () => {
    fetchStub.mockImplementation(url => {
      if (url.includes("/v1/search")) {
        return respond({ results: [
          { id: 726050, name: "Варна", country: "България", latitude: 43.21, longitude: 27.91 },
          { id: 1487764, name: "Varna", country: "Русия", latitude: 53.38, longitude: 60.98 }
        ] });
      }
      if (url.includes("/v1/get")) {
        return respond(url.includes("id=726050")
          ? { id: 726050, latitude: 43.21, longitude: 27.91, name: "Варна", country: "България" }
          : { id: 1487764, latitude: 53.38, longitude: 60.98, name: "Варна", country: "Русия" });
      }
      if (url.includes("air-quality")) return respond({ current: { european_aqi: 40 } });
      return answer(forecast);
    });
    show();
    await screen.findByText("София, България");

    const box = screen.getByRole("combobox");
    fireEvent.change(box, { target: { value: "Varna" } });
    await screen.findByRole("option", { name: /Русия/ }, { timeout: 2000 });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(await screen.findByText("Варна, България")).toBeTruthy();
    await waitFor(() => expect(location.pathname).toBe("/varna-balgariya-726050"));
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
      : answer(forecast)));
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
