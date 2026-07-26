// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../App.jsx";
import { SettingsProvider } from "../settings.jsx";

// A ten-day forecast shaped exactly like Open-Meteo's, generated instead of stored
// so the fixture stays readable.
const days = Array.from({ length: 10 }, (_, i) => `2026-07-${String(26 + i).padStart(2, "0")}`);
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

const fetchStub = vi.fn(url => {
  if (url.includes("/v1/forecast")) return respond(forecast);
  if (url.includes("air-quality")) return respond({ current: { european_aqi: 40 } });
  if (url.includes("/v1/get")) {
    return respond(url.includes("language=bg")
      ? { name: "Пловдив", country: "България" }
      : { name: "Plovdiv", country: "Bulgaria" });
  }
  if (url.includes("/v1/search")) {
    return respond({ results: [{ id: 728193, name: "Plovdiv", country: "Bulgaria", admin1: "Plovdiv", latitude: 42.15, longitude: 24.75 }] });
  }
  throw new Error(`unexpected request: ${url}`);
});

const show = () => render(<SettingsProvider><App /></SettingsProvider>);

beforeEach(() => {
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
    expect(await screen.findByText("Слънчев бряг, България")).toBeTruthy();
    expect(screen.getByText("26°C")).toBeTruthy();
    expect(screen.getAllByRole("button", { pressed: false }).length).toBeGreaterThan(0);
  });

  it("names the first two days and lists ten", async () => {
    show();
    await screen.findByText("Слънчев бряг, България");
    const forecastPanel = screen.getByRole("region", { name: "Прогноза за 10 дни" });
    expect(within(forecastPanel).getAllByRole("button")).toHaveLength(10);
    expect(within(forecastPanel).getByText("Днес")).toBeTruthy();
    expect(within(forecastPanel).getByText("Утре")).toBeTruthy();
  });

  it("shows live readings for today, including wind direction and air quality", async () => {
    show();
    await screen.findByText("Слънчев бряг, България");
    expect(screen.getByText("Вятър · ЮИ ↖")).toBeTruthy();
    expect(screen.getByText("Въздух · Задоволително")).toBeTruthy();
    expect(screen.getByText("1013 hPa")).toBeTruthy();
    expect(screen.getByText("24 km")).toBeTruthy();
  });

  it("opens the hourly strip from the current hour for today", async () => {
    show();
    await screen.findByText("Слънчев бряг, България");
    fireEvent.click(screen.getByRole("button", { name: /^Днес/ }));
    const strip = await screen.findByRole("region", { name: "Почасова прогноза" });
    expect(within(strip).getByText("18:00")).toBeTruthy();
    expect(within(strip).queryByText("00:00")).toBeNull();
    expect(strip.querySelector("svg path")).toBeTruthy(); // the temperature curve
  });

  it("turns the panel into a day summary when a future day is picked", async () => {
    show();
    await screen.findByText("Слънчев бряг, България");
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
    await screen.findByText("Слънчев бряг, България");
    fireEvent.click(screen.getByRole("button", { name: "°F" }));
    expect(await screen.findByText("78°F")).toBeTruthy();
    expect(screen.getByText("29.91 inHg")).toBeTruthy();
  });

  it("translates the whole interface, including the city name", async () => {
    show();
    await screen.findByText("Слънчев бряг, България");
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(await screen.findByText("Sunny Beach, Bulgaria")).toBeTruthy();
    expect(screen.getByText("10-Day Weather Forecast")).toBeTruthy();
    expect(screen.getByText("Pressure")).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");
  });

  it("searches, then re-translates the found city when the language changes", async () => {
    show();
    await screen.findByText("Слънчев бряг, България");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Plovdiv" } });
    const option = await screen.findByRole("option", { name: /Plovdiv/ }, { timeout: 2000 });
    fireEvent.click(option);

    expect(await screen.findByText("Пловдив, България")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(await screen.findByText("Plovdiv, Bulgaria")).toBeTruthy();
  });

  it("saves a city to the chip bar and keeps the link shareable", async () => {
    show();
    await screen.findByText("Слънчев бряг, България");
    fireEvent.click(screen.getByRole("button", { name: "Запази този град" }));

    const bar = await screen.findByRole("navigation", { name: "Запазени градове" });
    expect(within(bar).getByText("Слънчев бряг, България")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("favorites"))).toHaveLength(1);

    await waitFor(() => expect(location.search).toContain("lat=42.69"));
    expect(location.search).toContain("lang=bg");
    expect(location.search).toContain("key=defaultCity");

    fireEvent.click(within(bar).getByRole("button", { name: /Премахни/ }));
    expect(screen.queryByRole("navigation", { name: "Запазени градове" })).toBeNull();
  });

  it("starts from a shared link", async () => {
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
