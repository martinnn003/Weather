// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../App.jsx";
import { SettingsProvider } from "../settings.jsx";
import { HOUR_W, HOUR_GAP } from "../hours.js";
import { MERGE } from "../merge.js";
import { weatherFor } from "../weatherCodes.js";

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
    // 18+i to 28+i; now, at 18:30 on the first day, is halfway from 18:00's 25.8° to
    // 19:00's 26.3°, and reads 26.0° (78.8°F).
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
  if (url.includes("rainviewer")) {
    return respond({ host: "https://tilecache.rainviewer.com", radar: { past: [{ path: "/v2/radar/1", time: 1785085200 }] } });
  }
  throw new Error(`unexpected request: ${url}`);
};

// Leaflet draws into a box jsdom never lays out. The radar's tests ask only where the
// panel is, so the map is a stand-in that takes every call and draws nothing.
vi.mock("leaflet", () => {
  const map = { setView: () => map, remove: () => {} };
  return { default: { map: () => map, tileLayer: () => ({ addTo: () => {} }) } };
});

const fetchStub = vi.fn(defaultFetch);

const show = () => render(<SettingsProvider><App /></SettingsProvider>);

// The top panel's tiles' pictures. An icon name with no file behind it leaves no address,
// and the browser draws a broken image.
const tileIcons = () => [...document.querySelectorAll(".tile")]
  .map(tile => tile.querySelector("img")?.getAttribute("src"));

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
  vi.useRealTimers();
  delete document.visibilityState; // back to jsdom's own, if a test stood one in
});

describe("the app", () => {
  it("shows the placeholder first, then the forecast", async () => {
    show();
    expect(screen.getByRole("status", { name: "Зареждане на прогнозата" })).toBeTruthy();
    expect(await screen.findByText("София, България")).toBeTruthy();
    expect(screen.getByText("26.0°C")).toBeTruthy();
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
    const amounts = within(forecastPanel).getAllByText("1.2 мм");
    expect(amounts).toHaveLength(10);
    expect(amounts.every(amount => amount.querySelector("img")?.getAttribute("src"))).toBe(true);
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
    const iconOf = tile => tile.querySelector("img").getAttribute("src");
    expect(iconOf(tiles[0])).toBe(weatherFor(0, "bg").icon);
    expect(within(tiles[0]).getByText("0.0 мм")).toBeTruthy();
    // Showers, the sky being cloudless; 3 mm in the day is light, so one drop.
    expect(iconOf(tiles[1])).toBe(weatherFor(80, "bg").icon);
    expect(within(tiles[1]).getByText("3.0 мм")).toBeTruthy();
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
    expect(within(forecastPanel).getByText("0.0 мм")).toBeTruthy();
    expect(within(forecastPanel).getAllByText(/мм$/)).toHaveLength(1);
  });

  it("shows live readings for today, including wind direction and air quality", async () => {
    show();
    await screen.findByText("София, България");
    expect(screen.getByText("Вятър · ЮИ ↖")).toBeTruthy();
    expect(screen.getByText("Въздух · Задоволително")).toBeTruthy();
    expect(screen.getByText("1013 хПа")).toBeTruthy();
    expect(screen.getByText("24 км")).toBeTruthy();
    // The big number is now's, and so is this: the label ties the two together.
    expect(screen.getByText("Сега се усеща като")).toBeTruthy();
    expect(tileIcons()).toHaveLength(10);
    expect(tileIcons().every(Boolean)).toBe(true);
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

  it("says under every hour's temperature how it feels", async () => {
    show();
    await screen.findByText("София, България");
    fireEvent.click(screen.getByRole("button", { name: /^Утре/ }));
    const strip = await screen.findByRole("region", { name: "Почасова прогноза" });
    expect(within(strip).getAllByText(/^усещ\. -?\d+°$/)).toHaveLength(24);
    // Tomorrow at 15:00 is 25.5°, and feels a degree warmer.
    const cellFor = time => within(strip).getByText(time).closest("div[title]");
    expect(within(cellFor("15:00")).getByText("26°")).toBeTruthy();
    expect(within(cellFor("15:00")).getByText("усещ. 27°")).toBeTruthy();
    expect(cellFor("15:00").title).toContain("26° (усещ. 27°)");
  });

  it("leaves an hour's feel blank when the forecast has none", async () => {
    const plain = { ...forecast, hourly: { ...forecast.hourly, apparent_temperature: undefined } };
    fetchStub.mockImplementation(url => (url.includes("/v1/forecast")
      ? answer(plain)
      : defaultFetch(url)));
    show();
    await screen.findByText("София, България");
    fireEvent.click(screen.getByRole("button", { name: /^Утре/ }));
    const strip = await screen.findByRole("region", { name: "Почасова прогноза" });
    expect(within(strip).getAllByText(/^\d\d:00$/)).toHaveLength(24);
    expect(within(strip).queryByText(/усещ\./)).toBeNull();
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

  it("gives every hour its rain under its chance, a dry hour its nought", async () => {
    show();
    await screen.findByText("София, България");
    fireEvent.click(screen.getByRole("button", { name: /^Утре/ }));
    const strip = await screen.findByRole("region", { name: "Почасова прогноза" });
    const cellFor = time => within(strip).getByText(time).closest("div[title]");
    expect(within(strip).getAllByText(/мм$/)).toHaveLength(24);
    expect(within(cellFor("15:00")).getByText("0.3 мм")).toBeTruthy(); // the wet afternoon
    expect(within(cellFor("10:00")).getByText("0.0 мм")).toBeTruthy();
    expect(cellFor("15:00").title).toContain("0.3 мм");
  });

  it("leaves an hour's rain blank when the forecast has none, and only that hour's", async () => {
    const gap = {
      ...forecast,
      hourly: { ...forecast.hourly, precipitation: each(h => (h === 10 ? null : 0)) }
    };
    fetchStub.mockImplementation(url => (url.includes("/v1/forecast")
      ? answer(gap)
      : defaultFetch(url)));
    show();
    await screen.findByText("София, България");
    fireEvent.click(screen.getByRole("button", { name: /^Утре/ }));
    const strip = await screen.findByRole("region", { name: "Почасова прогноза" });
    const cellFor = time => within(strip).getByText(time).closest("div[title]");
    expect(within(strip).getAllByText(/мм$/)).toHaveLength(23);
    expect(within(cellFor("10:00")).queryByText(/мм$/)).toBeNull();
    expect(within(cellFor("11:00")).getByText("0.0 мм")).toBeTruthy();
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
    // ICON Global for four days, the slide into ECMWF on the fifth, ECMWF after; the rain is
    // ECMWF's throughout.
    expect(within(tiles[0]).getByText("T: ICON Global")).toBeTruthy();
    expect(within(tiles[4]).getByText("T: ICON Global→IFS")).toBeTruthy();
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
    // A day's feel is left to its hours: one figure would stand for the whole day.
    expect(screen.queryByText("Сега се усеща като")).toBeNull();
    expect(tileIcons()).toHaveLength(9);
    expect(tileIcons().every(Boolean)).toBe(true);
    const strip = screen.getByRole("region", { name: "Почасова прогноза" });
    expect(within(strip).getAllByText(/^\d\d:00$/)).toHaveLength(24);

    fireEvent.click(within(forecastPanel).getAllByRole("button")[3]); // deselect
    expect(await screen.findByText("Прогноза за времето за 10 дни")).toBeTruthy();
  });

  it("lists a picked day's hours under it on a phone, today's gone ones folded away", async () => {
    // Narrower than sm: the one query the app asks does not match.
    vi.stubGlobal("matchMedia", () =>
      ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    show();
    await screen.findByText("София, България");
    const forecastPanel = screen.getByRole("region", { name: "Прогноза за 10 дни" });

    fireEvent.click(within(forecastPanel).getAllByRole("button")[3]);
    const hourList = () => within(forecastPanel).getByRole("region", { name: "Почасова прогноза" });
    const times = () => within(hourList()).getAllByText(/^\d\d:00$/).map(el => el.textContent);
    expect(times()).toHaveLength(24);
    expect(within(hourList()).queryByRole("button")).toBeNull(); // a day ahead has nothing gone
    const rowFor = time => within(hourList()).getByText(time).closest("div[title]");
    expect(within(rowFor("15:00")).getByText("0.3 мм")).toBeTruthy();
    // Day 3 at 15:00 is 27.5° and feels 28.5°.
    expect(within(rowFor("15:00")).getByText("28°")).toBeTruthy();
    expect(within(rowFor("15:00")).getByText("усещ. 29°")).toBeTruthy();
    expect(within(rowFor("10:00")).getByText("0.0 мм")).toBeTruthy();

    const today = () => within(forecastPanel).getByRole("button", { name: /^Днес/ });
    fireEvent.click(today());
    expect(times()).toEqual(["18:00", "19:00", "20:00", "21:00", "22:00", "23:00"]); // now is 18:30

    fireEvent.click(within(hourList()).getByRole("button", { name: "▲ По-ранни часове (00–17)" }));
    expect(times()).toHaveLength(24);
    expect(times()[0]).toBe("00:00");
    const hide = within(hourList()).getByRole("button", { name: "▼ Скрий по-ранните часове" });
    expect(hide.getAttribute("aria-expanded")).toBe("true");

    // Closed and opened again, today starts folded.
    fireEvent.click(today());
    fireEvent.click(today());
    expect(times()[0]).toBe("18:00");
  });

  it("opens a picked day's summary under it on a phone, and leaves the top panel on now", async () => {
    vi.stubGlobal("matchMedia", () =>
      ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    show();
    await screen.findByText("София, България");
    const forecastPanel = screen.getByRole("region", { name: "Прогноза за 10 дни" });
    fireEvent.click(within(forecastPanel).getAllByRole("button")[3]);

    // The panel still reads the moment: now's 26.0°, not the day's high, and no date.
    expect(screen.getByText("Прогноза за времето за 10 дни")).toBeTruthy();
    expect(screen.queryByText("сряда, 29 юли")).toBeNull();
    expect(screen.getByText("26.0°C")).toBeTruthy();
    expect(screen.getByText("Влажност")).toBeTruthy();

    // Under the day, over its hours: what the row leaves out, and nothing it already says.
    const summary = within(forecastPanel).getByRole("region", { name: "Обобщение за деня" });
    const hours = within(forecastPanel).getByRole("region", { name: "Почасова прогноза" });
    expect(summary.compareDocumentPosition(hours) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const label of ["Пориви", "UV индекс", "Валежи", "Изгрев", "Залез"]) {
      expect(within(summary).getByText(label)).toBeTruthy();
    }
    for (const label of ["Макс.", "Мин.", "Количество", "Сега се усеща като"]) {
      expect(within(summary).queryByText(label)).toBeNull();
    }
    expect(within(summary).getByText("06:05")).toBeTruthy();
    expect([...summary.querySelectorAll("img")].every(img => img.getAttribute("src"))).toBe(true);

    // Past UV's reach the tile is left out, not shown as a 0.
    fireEvent.click(within(forecastPanel).getAllByRole("button")[9]);
    const lastDay = within(forecastPanel).getByRole("region", { name: "Обобщение за деня" });
    expect(within(lastDay).queryByText("UV индекс")).toBeNull();

    fireEvent.click(within(forecastPanel).getAllByRole("button")[9]); // deselect
    expect(within(forecastPanel).queryByRole("region", { name: "Обобщение за деня" })).toBeNull();
  });

  it("switches units", async () => {
    show();
    await screen.findByText("София, България");
    fireEvent.click(screen.getByRole("button", { name: "°F" }));
    expect(await screen.findByText("78.8°F")).toBeTruthy();
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
    expect(screen.getAllByText("1.2 mm")).toHaveLength(10);
    expect(screen.getByText(/^Weather data: · ICON/)).toBeTruthy();
  });

  it("draws the navbar's sun, pin and radar, and names the buttons in words", async () => {
    show();
    await screen.findByText("София, България");
    const drawn = [
      screen.getByRole("link", { name: "MeteoDita — начало" }),
      screen.getByRole("button", { name: "Моето местоположение" }),
      screen.getByRole("button", { name: "Радар за валежи" })
    ].map(el => el.querySelector("img")?.getAttribute("src"));
    expect(drawn.every(Boolean)).toBe(true);
  });

  it("brings the radar into view when it is opened, and not when the city changes under it", async () => {
    // jsdom has no scrollIntoView at all, so it is added rather than spied on.
    const scrolledTo = [];
    Element.prototype.scrollIntoView = function () { scrolledTo.push(this); };
    try {
      show();
      await screen.findByText("София, България");
      const radarButton = screen.getByRole("button", { name: "Радар за валежи" });

      fireEvent.click(radarButton);
      const radar = await screen.findByRole("region", { name: "Радар за валежи" });
      await waitFor(() => expect(scrolledTo).toEqual([radar]));

      fireEvent.change(screen.getByRole("combobox"), { target: { value: "Plovdiv" } });
      fireEvent.click(await screen.findByRole("option", { name: /Plovdiv/ }, { timeout: 2000 }));
      await screen.findByText("Пловдив, България");
      await screen.findByRole("region", { name: "Радар за валежи" });
      expect(scrolledTo).toHaveLength(1); // drawn again for the new city, and left where it is

      fireEvent.click(radarButton);
      expect(screen.queryByRole("region", { name: "Радар за валежи" })).toBeNull();
      fireEvent.click(radarButton);
      await waitFor(() => expect(scrolledTo).toHaveLength(2)); // asked for again, so shown again
    } finally {
      delete Element.prototype.scrollIntoView;
    }
  });

  it("offers a way back to the top on a phone, once the first screen is scrolled past", async () => {
    vi.stubGlobal("matchMedia", () =>
      ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    const scrollDown = y => {
      Object.defineProperty(window, "scrollY", { value: y, configurable: true });
      fireEvent.scroll(window);
    };
    try {
      show();
      await screen.findByText("София, България");
      // Hidden, it is out of reach as well as out of sight.
      expect(screen.queryByRole("button", { name: "Към началото" })).toBeNull();

      scrollDown(window.innerHeight + 1);
      fireEvent.click(screen.getByRole("button", { name: "Към началото" }));
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });

      scrollDown(0);
      expect(screen.queryByRole("button", { name: "Към началото" })).toBeNull();
    } finally {
      Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    }
  });

  it("leaves the button to the top off a wide screen, where the page is barely longer than it", async () => {
    show();
    await screen.findByText("София, България");
    Object.defineProperty(window, "scrollY", { value: window.innerHeight + 1, configurable: true });
    try {
      fireEvent.scroll(window);
      expect(screen.queryByRole("button", { name: "Към началото", hidden: true })).toBeNull();
    } finally {
      Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    }
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
    expect(screen.getByText("78.8°F")).toBeTruthy();
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
    expect(screen.getByText("78.8°F")).toBeTruthy();
  });

  it("reports a failed load", async () => {
    fetchStub.mockImplementation(url => (url.includes("/v1/forecast")
      ? Promise.resolve({ ok: false, status: 500 })
      : respond({ current: {} })));
    show();
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent", "Данните за времето не можаха да се заредят.");
  });

  const forecastAsked = () => fetchStub.mock.calls.filter(([url]) => url.includes("/v1/forecast")).length;

  it("rides out an overloaded server and a dropped connection without a word", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
    const failures = [
      () => Promise.resolve({ ok: false, status: 503 }),
      () => Promise.reject(new TypeError("Failed to fetch"))
    ];
    fetchStub.mockImplementation(url => (url.includes("/v1/forecast") && failures.length
      ? failures.shift()()
      : defaultFetch(url)));
    show();
    await act(() => vi.advanceTimersByTimeAsync(1000)); // the first try again
    expect(forecastAsked()).toBe(2);
    await act(() => vi.advanceTimersByTimeAsync(3000)); // and the second
    expect(await screen.findByText("София, България")).toBeTruthy();
    expect(forecastAsked()).toBe(3);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("gives up after the third try, and asks only once for an error that would not pass", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
    fetchStub.mockImplementation(url => (url.includes("/v1/forecast")
      ? Promise.resolve({ ok: false, status: 503 })
      : defaultFetch(url)));
    show();
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(forecastAsked()).toBe(3);

    cleanup();
    fetchStub.mockClear();
    fetchStub.mockImplementation(url => (url.includes("/v1/forecast")
      ? Promise.resolve({ ok: false, status: 500 })
      : defaultFetch(url)));
    show();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(forecastAsked()).toBe(1);
  });

  it("asks again from the button beside a failed load", async () => {
    fetchStub.mockImplementation(url => (url.includes("/v1/forecast")
      ? Promise.resolve({ ok: false, status: 500 })
      : defaultFetch(url)));
    show();
    await screen.findByRole("alert");

    fetchStub.mockImplementation(defaultFetch);
    fireEvent.click(screen.getByRole("button", { name: "Опитай отново" }));
    expect(await screen.findByText("София, България")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Опитай отново" })).toBeNull();
  });

  it("asks again when the brand is clicked at home, so a failed home page is not stuck", async () => {
    fetchStub.mockImplementation(url => (url.includes("/v1/forecast")
      ? Promise.resolve({ ok: false, status: 500 })
      : defaultFetch(url)));
    show();
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("link", { name: "MeteoDita — начало" }));
    await waitFor(() => expect(forecastAsked()).toBe(2));

    fetchStub.mockImplementation(defaultFetch);
    fireEvent.click(screen.getByRole("link", { name: "MeteoDita — начало" }));
    expect(await screen.findByText("София, България")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("asks again a minute past every quarter hour while in view, and on coming back", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date(2026, 6, 26, 18, 10));
    const asked = () => fetchStub.mock.calls.filter(([url]) => url.includes("/v1/forecast")).length;
    show();
    await screen.findByText("София, България");
    expect(asked()).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(5 * 60 * 1000)); // 18:15, Open-Meteo still turning over
    expect(asked()).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(60 * 1000)); // 18:16
    expect(asked()).toBe(2);

    // Out of view past 18:31 the page asks nothing, and catches up when it is back.
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(() => vi.advanceTimersByTimeAsync(20 * 60 * 1000)); // 18:36
    expect(asked()).toBe(2);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await waitFor(() => expect(asked()).toBe(3));
  });

  it("tints the phone's browser bar with the top of the sky, by night as well", async () => {
    // The sky's colours are the stylesheet's, which the tests do not load; these stand in.
    const sheet = document.createElement("style");
    sheet.textContent = "body.weather-clear { --sky-top: #006cac } body.night { --sky-top: #1e293b }";
    const bar = Object.assign(document.createElement("meta"), { name: "theme-color" });
    document.head.append(sheet, bar);
    try {
      show();
      await screen.findByText("София, България");
      expect(bar.content).toBe("#006cac");

      cleanup();
      fetchStub.mockImplementation(url => (url.includes("/v1/forecast")
        ? answer({ ...forecast, current: { ...forecast.current, is_day: 0 } })
        : defaultFetch(url)));
      show();
      await waitFor(() => expect(bar.content).toBe("#1e293b"));
    } finally {
      sheet.remove();
      bar.remove();
    }
  });
});
