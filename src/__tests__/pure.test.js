import { describe, expect, it } from "vitest";
import { I18N, LANGS, pickLang } from "../i18n.js";
import { CODES, groupFor, weatherFor } from "../weatherCodes.js";
import { aqiBand, formatters } from "../format.js";
import { hoursForDay, sparkGeometry, HOUR_W, HOUR_GAP } from "../hours.js";
import { pathFor, placeFromUrl, samePlace } from "../place.js";
import { MERGE, daySources, mergeForecast } from "../merge.js";
import { searchLangFor } from "../api.js";

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

  it("abbreviates the short date the way each language reads it", () => {
    expect(I18N.en.dateShort(7, 7)).toBe("Aug 7");
    expect(I18N.bg.dateShort(7, 7)).toBe("7 авг");
    expect(I18N.en.dateShort(1, 0)).toBe("Jan 1");
    expect(I18N.bg.dateShort(31, 11)).toBe("31 дек");
    // Intl would give Bulgarian "7.08" here, which is why the months are spelled out.
    for (const language of LANGS) {
      for (let month = 0; month < 12; month++) {
        expect(I18N[language].dateShort(7, month)).not.toMatch(/\d\D*\d/);
      }
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
  const metricEn = formatters("c", I18N.en);
  const imperial = formatters("f", I18N.en);

  it("converts temperature and wind", () => {
    expect(metric.temp(25.4)).toBe("25°");
    expect(imperial.temp(25)).toBe("77°");
    expect(metric.wind(12.3)).toBe("12 км/ч");
    expect(imperial.wind(16.09)).toBe("10 mph");
  });

  it("converts pressure, distance and rainfall", () => {
    expect(metric.pressure(1012.8)).toBe("1013 хПа");
    expect(imperial.pressure(1013)).toBe("29.91 inHg");
    expect(metric.distance(24140)).toBe("24 км");
    expect(imperial.distance(16090)).toBe("10 mi");
    expect(metric.rain(2.35)).toBe("2,4 мм");
    expect(imperial.rain(25.4)).toBe("1.00 in");
  });

  it("names the metric units in the language's own script", () => {
    expect([metric.wind(12.3), metric.rain(2.35), metric.distance(24140), metric.pressure(1012.8)])
      .toEqual(["12 км/ч", "2,4 мм", "24 км", "1013 хПа"]);
    expect([metricEn.wind(12.3), metricEn.rain(2.35), metricEn.distance(24140), metricEn.pressure(1012.8)])
      .toEqual(["12 km/h", "2.4 mm", "24 km", "1013 hPa"]);
  });

  it("writes decimals with a comma on the Bulgarian page and a point on the English one", () => {
    const imperialBg = formatters("f", I18N.bg);
    expect(metric.rain(1.2)).toBe("1,2 мм");
    expect(metricEn.rain(1.2)).toBe("1.2 mm");
    // Every number, an imperial one too; only the unit's name keeps its usual form.
    expect(imperialBg.pressure(1013)).toBe("29,91 inHg");
    expect(imperialBg.rain(25.4)).toBe("1,00 in");
    expect(imperial.pressure(1013)).toBe("29.91 inHg");
  });

  it("rounds as before, and never groups digits or prints a minus nought", () => {
    expect(metricEn.pressure(1013.2)).toBe("1013 hPa"); // not 1,013
    expect(metric.temp(-2.5)).toBe("-2°"); // Math.round's half, as it always was
    expect(metric.temp(-0.3)).toBe("0°"); // not -0°
    expect(metric.percent(61)).toBe("61%");
    expect(metric.num(4.95)).toBe("5");
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
  it("keeps today whole and marks the hours that already passed", () => {
    const hours = hoursForDay(sampleData, 0);
    expect(hours).toHaveLength(24);
    expect(hours[0].time).toBe("2026-07-26T00:00");
    expect(hours.findIndex(hour => !hour.past)).toBe(18); // now is 18:30
    expect(hours[17].past).toBe(true);
    expect(hours[23].past).toBe(false);
  });

  it("keeps a full day for any other day, none of it past", () => {
    const hours = hoursForDay(sampleData, 1);
    expect(hours).toHaveLength(24);
    expect(hours[0].time).toBe("2026-07-27T00:00");
    expect(hours.some(hour => hour.past)).toBe(false);
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

// Six days of two models that disagree by exactly 10°, so a blended hour shows how far
// along the seam it is: ICON-EU says 10°, ECMWF 20°.
const twoModels = (overrides = {}) => {
  const hours = 6 * 24;
  const dates = Array.from({ length: 6 }, (_, d) => `2026-10-0${d + 1}`);
  const time = Array.from({ length: hours }, (_, i) =>
    `${dates[Math.floor(i / 24)]}T${String(i % 24).padStart(2, "0")}:00`);
  const flat = value => Array.from({ length: hours }, () => value);
  const both = (name, icon, ecmwf) => ({
    [`${name}_${MERGE.icon}`]: icon, [`${name}_${MERGE.ecmwf}`]: ecmwf
  });
  return {
    current: { time: "2026-10-01T09:15", is_day: 1 },
    daily: { time: dates, ...both("sunrise", dates.map(d => `${d}T07:10`), dates.map(() => null)) },
    hourly: {
      time,
      ...both("temperature_2m", flat(10), flat(20)),
      ...both("precipitation", flat(1), flat(0)),
      ...both("weather_code", flat(61), flat(0)),
      ...both("wind_speed_10m", flat(30), flat(5)),
      ...both("wind_direction_10m", flat(90), flat(90)),
      ...both("cloud_cover", flat(10), flat(10)),
      ...overrides
    }
  };
};

describe("merging the models", () => {
  it("keeps ICON-EU before the seam, ECMWF after it, and slides between them", () => {
    const { hourly, sources } = mergeForecast(twoModels());
    const { start, end } = MERGE.seam;
    expect(hourly.temperature_2m[0]).toBe(10);
    expect(hourly.temperature_2m[start - 1]).toBe(10);
    expect(hourly.temperature_2m[(start + end) / 2]).toBe(15);
    expect(hourly.temperature_2m[end]).toBe(20);
    expect([sources.temperature_2m[0], sources.temperature_2m[start + 1], sources.temperature_2m[end]])
      .toEqual(["icon", "blend", "ecmwf"]);
  });

  it("takes rain and wind from ECMWF from the very first hour", () => {
    const { hourly } = mergeForecast(twoModels());
    expect(hourly.precipitation[0]).toBe(0);
    expect(hourly.wind_speed_10m[0]).toBe(5);
  });

  it("lets either model stand in where the other has nothing", () => {
    const iconGap = Array.from({ length: 144 }, (_, i) => (i === 5 ? null : 10));
    const ecmwfGap = Array.from({ length: 144 }, (_, i) => (i === 130 ? null : 20));
    const { hourly, sources, daily } = mergeForecast(twoModels({
      [`temperature_2m_${MERGE.icon}`]: iconGap,
      [`temperature_2m_${MERGE.ecmwf}`]: ecmwfGap
    }));
    expect([hourly.temperature_2m[5], sources.temperature_2m[5]]).toEqual([20, "ecmwf"]);
    expect([hourly.temperature_2m[130], sources.temperature_2m[130]]).toEqual([10, "icon"]);
    expect(daily.sunrise[5]).toBe("2026-10-06T07:10"); // ECMWF's is missing
  });

  it("works the day out from the merged hours, not from either model's day", () => {
    const { daily } = mergeForecast(twoModels({
      [`precipitation_${MERGE.ecmwf}`]: Array.from({ length: 144 }, (_, i) => (i < 24 ? 0.1 : 0))
    }));
    expect(daily.temperature_2m_max[0]).toBe(10);
    expect(daily.temperature_2m_max[5]).toBe(20);
    expect(daily.precipitation_sum[0]).toBe(2.4); // ECMWF's, not ICON-EU's 24 mm
    expect(daily.wind_speed_10m_max[0]).toBe(5);
    expect(daily.wind_direction_10m_dominant[0]).toBe(90);
  });

  it("reads now off the merged hour it falls in", () => {
    const { current } = mergeForecast(twoModels({
      [`pressure_msl_${MERGE.icon}`]: Array.from({ length: 144 }, (_, i) => 1000 + i)
    }));
    expect(current.time).toBe("2026-10-01T09:15");
    expect(current.temperature_2m).toBe(10); // ICON-EU's
    expect(current.wind_speed_10m).toBe(5); // ECMWF's
    expect(current.pressure_msl).toBe(1009);
  });

  it("finds a day's wind between 350° and 10° at north, not at south", () => {
    const { daily } = mergeForecast(twoModels({
      [`wind_direction_10m_${MERGE.ecmwf}`]: Array.from({ length: 144 }, (_, i) => (i % 2 ? 350 : 10))
    }));
    expect(daily.wind_direction_10m_dominant[0]).toBe(0);
  });

  it("gives a day UV only when the air-quality forecast covers all of it", () => {
    const raw = twoModels();
    const air = {
      current: { uv_index: 3.1 },
      hourly: {
        time: raw.hourly.time.slice(0, 36), // all of the first day, half of the second
        uv_index: raw.hourly.time.slice(0, 36).map((_, i) => (i % 24 === 13 ? 6 : 0))
      }
    };
    const { current, daily } = mergeForecast(raw, air);
    expect(current.uv_index).toBe(3.1);
    expect(daily.uv_index_max.slice(0, 3)).toEqual([6, null, null]);
    expect(mergeForecast(raw).daily.uv_index_max[0]).toBeNull(); // no air-quality answer
  });

  it("names a day's models for ?debug=1", () => {
    const data = mergeForecast(twoModels());
    expect(daySources(data, "temperature_2m", "2026-10-01")).toBe("ICON-EU");
    expect(daySources(data, "temperature_2m", "2026-10-05")).toBe("ICON-EU→IFS");
    expect(daySources(data, "temperature_2m", "2026-10-06")).toBe("IFS");
    expect(daySources(data, "precipitation", "2026-10-01")).toBe("IFS");
  });
});

// The six days' hours, from a function of the hour of the day and the day.
const sixDays = make => Array.from({ length: 144 }, (_, i) => make(i % 24, Math.floor(i / 24)));
const ecmwfRain = make => ({ [`precipitation_${MERGE.ecmwf}`]: sixDays(make) });

// By default ICON-EU's code has it raining every hour, ECMWF's rainfall is nothing, and
// the sky is 10% cloud: so unless a test adds rain, every icon below should come out clear.
describe("building the icons from the merged readings", () => {
  const icons = overrides => mergeForecast(twoModels(overrides));

  it("shows no 🌦️ over 0 mm, whatever the model's code says", () => {
    const { hourly, daily } = icons();
    expect(daily.precipitation_sum[0]).toBe(0);
    expect(weatherFor(daily.weather_code[0], "bg").icon).toBe(CODES[0].icon);
    expect(hourly.weather_code.slice(0, 24).every(code => code === 0)).toBe(true);
  });

  it("shows no ☀️ over 3 mm, whatever the model's code says", () => {
    // Both models' codes say clear; ECMWF rains a millimetre an hour from 14:00 to 17:00.
    const { hourly, daily } = icons({
      [`weather_code_${MERGE.icon}`]: sixDays(() => 0),
      ...ecmwfRain(h => (h >= 14 && h < 17 ? 1 : 0))
    });
    expect(daily.precipitation_sum[0]).toBe(3);
    expect(weatherFor(daily.weather_code[0], "bg").icon).toBe(CODES[61].icon);
    expect(hourly.weather_code[15]).toBe(61);
    expect(hourly.weather_code[12]).toBe(0); // dry before it
  });

  it("leaves an hour under 0.1 mm dry, and a day under 0.2 mm", () => {
    // Two hours of 0.05 mm on the first day, two of 0.1 mm on the second.
    const { hourly, daily } = icons(ecmwfRain((h, d) => (h === 14 || h === 15 ? [0.05, 0.1][d] ?? 0 : 0)));
    expect([hourly.weather_code[14], daily.weather_code[0]]).toEqual([0, 0]);
    expect([hourly.weather_code[24 + 14], daily.weather_code[1]]).toEqual([61, 61]);
  });

  it("grades a day's rain by its heaviest hour", () => {
    const { daily } = icons(ecmwfRain((h, d) => (h === 14 ? [1, 3, 8][d] ?? 0 : 0)));
    expect(daily.weather_code.slice(0, 3)).toEqual([61, 63, 65]);
  });

  it("makes it snow only where ECMWF has snowfall", () => {
    const { hourly, daily } = icons({
      ...ecmwfRain(h => (h === 14 ? 1 : 0)),
      [`snowfall_${MERGE.ecmwf}`]: sixDays((h, d) => (d === 0 && h === 14 ? 0.7 : 0))
    });
    expect([hourly.weather_code[14], daily.weather_code[0]]).toEqual([71, 71]);
    expect(daily.weather_code[1]).toBe(61);
  });

  it("grades snow by its own depth an hour, not by its water", () => {
    // The same millimetre of water each day, falling as 1.2, 1.3, 2.5 and 2.6 cm of snow:
    // either side of 1.3, where light turns moderate, and of 2.5, where moderate turns heavy.
    const depths = [1.2, 1.3, 2.5, 2.6];
    const { hourly, daily } = icons({
      ...ecmwfRain(h => (h === 14 ? 1 : 0)),
      [`snowfall_${MERGE.ecmwf}`]: sixDays((h, d) => (h === 14 ? depths[d] ?? 0 : 0))
    });
    expect(daily.weather_code.slice(0, 4)).toEqual([71, 73, 73, 75]);
    expect([0, 1, 2, 3].map(d => hourly.weather_code[d * 24 + 14])).toEqual([71, 73, 73, 75]);
  });

  it("keeps the model's storm only where something falls", () => {
    // ICON-EU calls a thunderstorm at 14:00 every day; only the first day has the rain for one.
    const { hourly, daily } = icons({
      [`weather_code_${MERGE.icon}`]: sixDays(h => (h === 14 ? 95 : 0)),
      ...ecmwfRain((h, d) => (d === 0 && h === 14 ? 2 : 0))
    });
    expect([hourly.weather_code[14], daily.weather_code[0]]).toEqual([95, 95]);
    expect([hourly.weather_code[24 + 14], daily.weather_code[1]]).toEqual([0, 0]);
  });

  it("asks ICON-EU about storms until the seam ends, and ECMWF after", () => {
    const { hourly } = icons({
      [`weather_code_${MERGE.icon}`]: sixDays(() => 95),
      ...ecmwfRain(() => 1)
    });
    expect(hourly.weather_code[MERGE.seam.end - 1]).toBe(95);
    expect(hourly.weather_code[MERGE.seam.end]).toBe(61);
  });

  it("reads a dry hour's sky off the cloud cover", () => {
    const covers = [0, 19, 20, 49, 50, 80, 81, 100];
    const { hourly } = icons({ [`cloud_cover_${MERGE.icon}`]: sixDays(h => covers[h] ?? 0) });
    expect(hourly.weather_code.slice(0, 8)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it("gives a dry day the sky of its daytime, not of its night", () => {
    // Overcast all night, clear from 08:00 to 18:00.
    const { daily } = icons({ [`cloud_cover_${MERGE.icon}`]: sixDays(h => (h >= 8 && h <= 18 ? 0 : 100)) });
    expect(daily.weather_code[0]).toBe(0);
  });

  it("keeps the model's fog on a dry hour, and calls a day foggy only if fog held most of it", () => {
    // Fog until 10:00 on the first day, until 15:00 on the second.
    const { hourly, daily } = icons({
      [`weather_code_${MERGE.icon}`]: sixDays((h, d) => (h < ([10, 15][d] ?? 0) ? 45 : 0))
    });
    expect(hourly.weather_code[9]).toBe(45);
    expect(daily.weather_code[0]).toBe(0); // 08:00 and 09:00, two of eleven daytime hours
    expect(daily.weather_code[1]).toBe(45); // 08:00 to 14:00, seven of eleven
  });
});

describe("city search", () => {
  it("searches the Bulgarian index for anything typed in Cyrillic", () => {
    expect(searchLangFor("София", "en")).toBe("bg");
    expect(searchLangFor("Пловдив", "bg")).toBe("bg");
  });

  it("leaves a Latin query in the language of the interface", () => {
    expect(searchLangFor("Sofia", "en")).toBe("en");
    expect(searchLangFor("Sofia", "bg")).toBe("bg");
    expect(searchLangFor("München", "en")).toBe("en");
  });
});

describe("places", () => {
  it("reads a city address", () => {
    expect(placeFromUrl("/plovdiv-bulgaria-728193", "?lang=bg"))
      .toMatchObject({ lat: null, lon: null, geoId: "728193", label: "plovdiv-bulgaria" });
    expect(placeFromUrl("/", "?lang=bg")).toBeNull();
  });

  it("reads the id even when the words in front are wrong", () => {
    expect(placeFromUrl("/пловдив-728193", "")).toMatchObject({ geoId: "728193" });
    expect(placeFromUrl("/plovidv-mispelt-728193", "")).toMatchObject({ geoId: "728193" });
    expect(placeFromUrl("/728193", "")).toMatchObject({ geoId: "728193", label: "" });
  });

  it("still reads an old query-string link", () => {
    const place = placeFromUrl("/", "?lat=42.15&lon=24.75&city=Plovdiv&id=728193&lang=bg&unit=f");
    expect(place).toMatchObject({ lat: 42.15, lon: 24.75, label: "Plovdiv", geoId: "728193" });
  });

  it("writes a city address, transliterating and dropping punctuation", () => {
    expect(pathFor({ geoId: "728193" }, "Plovdiv, Bulgaria")).toBe("/plovdiv-bulgaria-728193");
    expect(pathFor({ geoId: "728193" }, "Пловдив, България")).toBe("/plovdiv-balgariya-728193");
    expect(pathFor({ geoId: "2867714" }, "München, Germany")).toBe("/munchen-germany-2867714");
    expect(pathFor({ geoId: "728193" }, "")).toBe("/728193"); // before the name arrives
    expect(pathFor({ geoId: null, lat: 42.1, lon: 24.7 }, "My Location")).toBe("/");
  });

  it("comes back from its own address unchanged", () => {
    const path = pathFor({ geoId: "728193" }, "Пловдив, България");
    expect(placeFromUrl(path, "")).toMatchObject({ geoId: "728193" });
    expect(pathFor(placeFromUrl(path, ""), null)).toBe(path);
  });

  it("matches places by id, then by proximity", () => {
    expect(samePlace({ geoId: 1, lat: 0, lon: 0 }, { geoId: 1, lat: 9, lon: 9 })).toBe(true);
    expect(samePlace({ geoId: 1, lat: 0, lon: 0 }, { geoId: 2, lat: 0, lon: 0 })).toBe(false);
    expect(samePlace({ lat: 42.69, lon: 27.71 }, { lat: 42.7, lon: 27.72 })).toBe(true);
    expect(samePlace({ lat: 42.69, lon: 27.71 }, { lat: 43.2, lon: 27.71 })).toBe(false);
    expect(samePlace(null, { lat: 1, lon: 1 })).toBe(false);
  });
});
