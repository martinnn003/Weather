import { describe, expect, it } from "vitest";
import { I18N, LANGS, pickLang } from "../i18n.js";
import { CODES, groupFor, weatherFor } from "../weatherCodes.js";
import { aqiBand, formatters } from "../format.js";
import { hoursForDay, sparkGeometry, HOUR_W, HOUR_GAP } from "../hours.js";
import { placeFromUrl, samePlace } from "../place.js";

describe("translations", () => {
  it("carries the same keys in every language", () => {
    const [reference, ...rest] = LANGS.map(code => Object.keys(I18N[code]).sort());
    for (const keys of rest) expect(keys).toEqual(reference);
  });

  it("labels every weather code in every language", () => {
    for (const [code, entry] of Object.entries(CODES)) {
      for (const language of LANGS) {
        expect(entry[language], `code ${code} in ${language}`).toBeTruthy();
      }
      expect(entry.icon).toBeTruthy();
    }
  });

  it("prefers the link, then the stored choice, then the browser", () => {
    expect(pickLang("bg", "en", "en-US")).toBe("bg");
    expect(pickLang(null, "bg", "en-US")).toBe("bg");
    expect(pickLang(null, null, "bg-BG")).toBe("bg");
    expect(pickLang(null, null, "de-DE")).toBe("en");
    expect(pickLang("klingon", null, "de-DE")).toBe("en");
  });
});

describe("weather codes", () => {
  it("uses the night icon only where one is defined", () => {
    expect(weatherFor(0, "bg", false).icon).toBe("🌙");
    expect(weatherFor(0, "bg", true).icon).toBe("☀️");
    expect(weatherFor(63, "bg", false).icon).toBe(weatherFor(63, "bg", true).icon);
  });

  it("falls back for an unknown code", () => {
    expect(weatherFor(1234, "en")).toEqual({ icon: "❓", label: null });
  });

  it("maps codes to background groups", () => {
    expect(groupFor(0)).toBe("clear");
    expect(groupFor(3)).toBe("clouds");
    expect(groupFor(48)).toBe("fog");
    expect(groupFor(75)).toBe("snow");
    expect(groupFor(63)).toBe("rain");
    expect(groupFor(99)).toBe("storm");
  });
});

describe("formatting", () => {
  const metric = formatters("c", I18N.bg);
  const imperial = formatters("f", I18N.en);

  it("converts temperature and wind", () => {
    expect(metric.temp(25.4)).toBe("25°");
    expect(imperial.temp(25)).toBe("77°");
    expect(metric.wind(12.3)).toBe("12 km/h");
    expect(imperial.wind(16.09)).toBe("10 mph");
  });

  it("converts pressure, distance and rainfall", () => {
    expect(metric.pressure(1012.8)).toBe("1013 hPa");
    expect(imperial.pressure(1013)).toBe("29.91 inHg");
    expect(metric.distance(24140)).toBe("24 km");
    expect(imperial.distance(16090)).toBe("10 mi");
    expect(metric.rain(2.35)).toBe("2.4 mm");
    expect(imperial.rain(25.4)).toBe("1.00 in");
  });

  it("points the wind arrow where the wind blows to", () => {
    expect(metric.windLabel(0)).toBe("Вятър · С ↓");   // from the north, blowing south
    expect(metric.windLabel(132)).toBe("Вятър · ЮИ ↖");
    expect(imperial.windLabel(270)).toBe("Wind · W →");
  });

  it("bands the air quality index", () => {
    expect([0, 20, 21, 61, 101].map(aqiBand)).toEqual([0, 0, 1, 3, 5]);
    expect(I18N.bg.aqi[aqiBand(40)]).toBe("Задоволително");
  });
});

// One synthetic day and a half, enough to exercise the filtering.
const sampleData = {
  current: { time: "2026-07-26T18:30" },
  daily: { time: ["2026-07-26", "2026-07-27"] },
  hourly: {
    time: Array.from({ length: 48 }, (_, i) =>
      `2026-07-${26 + Math.floor(i / 24)}T${String(i % 24).padStart(2, "0")}:00`),
    temperature_2m: Array.from({ length: 48 }, (_, i) => 15 + (i % 24) / 2),
    weather_code: Array.from({ length: 48 }, () => 0),
    precipitation_probability: Array.from({ length: 48 }, () => 10),
    is_day: Array.from({ length: 48 }, (_, i) => ((i % 24) >= 6 && (i % 24) < 21 ? 1 : 0))
  }
};

describe("hourly strip", () => {
  it("drops the hours that already passed today", () => {
    const hours = hoursForDay(sampleData, 0);
    expect(hours).toHaveLength(6); // 18:00 … 23:00
    expect(hours[0].time).toBe("2026-07-26T18:00");
  });

  it("keeps a full day for any other day", () => {
    const hours = hoursForDay(sampleData, 1);
    expect(hours).toHaveLength(24);
    expect(hours[0].time).toBe("2026-07-27T00:00");
  });

  it("sizes the curve to the cells beneath it", () => {
    const values = hoursForDay(sampleData, 1).map(hour => hour.temp);
    const geometry = sparkGeometry(values);
    expect(geometry.width).toBe(24 * (HOUR_W + HOUR_GAP) - HOUR_GAP);
    expect(geometry.line.startsWith("M ")).toBe(true);
    expect(geometry.line).toContain(" C "); // smoothed, not a polyline
    expect(geometry.area.endsWith("Z")).toBe(true);
  });

  it("marks the high and the low, and nothing else", () => {
    expect(sparkGeometry([5, 9, 7]).markers).toHaveLength(2);
    expect(sparkGeometry([5, 5, 5]).markers).toHaveLength(1); // flat day: one marker
    expect(sparkGeometry([5])).toBeNull();
  });
});

describe("places", () => {
  it("reads a shared link", () => {
    const place = placeFromUrl("?lat=42.15&lon=24.75&city=Plovdiv&id=728193&lang=bg&unit=f");
    expect(place).toMatchObject({ lat: 42.15, lon: 24.75, label: "Plovdiv", geoId: "728193" });
    expect(placeFromUrl("?lang=bg")).toBeNull();
  });

  it("matches places by id, then by proximity", () => {
    expect(samePlace({ geoId: 1, lat: 0, lon: 0 }, { geoId: 1, lat: 9, lon: 9 })).toBe(true);
    expect(samePlace({ geoId: 1, lat: 0, lon: 0 }, { geoId: 2, lat: 0, lon: 0 })).toBe(false);
    expect(samePlace({ lat: 42.69, lon: 27.71 }, { lat: 42.7, lon: 27.72 })).toBe(true);
    expect(samePlace({ lat: 42.69, lon: 27.71 }, { lat: 43.2, lon: 27.71 })).toBe(false);
    expect(samePlace(null, { lat: 1, lon: 1 })).toBe(false);
  });
});
