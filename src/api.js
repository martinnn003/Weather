import { forecastQuery, mergeForecast } from "./merge.js";

// Every endpoint here is free and needs no key. Which models the forecast is asked of,
// and how their answers are combined, is merge.js's business; only the clock and is_day
// are asked for as "current", since the readings for now come out of the merge.
const FORECAST = `${forecastQuery()}&daily=sunrise,sunset&current=is_day&timezone=auto&forecast_days=10`;

// The air-quality answer also carries the UV, CAMS's, which neither forecast model has.
// It reaches about five days; seven are asked for so that none of them is cut short.
const AIR = "&current=european_aqi,uv_index&hourly=uv_index&timezone=auto&forecast_days=7";

const json = async res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// The forecast is required; air quality is a bonus that must never break it.
export async function fetchWeather(lat, lon) {
  const [weather, air] = await Promise.allSettled([
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}${FORECAST}`).then(json),
    fetch("https://air-quality-api.open-meteo.com/v1/air-quality" +
      `?latitude=${lat}&longitude=${lon}${AIR}`).then(json)
  ]);
  if (weather.status === "rejected") throw weather.reason;
  const airValue = air.status === "fulfilled" ? air.value : null;
  return {
    data: mergeForecast(weather.value, airValue),
    aqi: airValue?.current?.european_aqi ?? null
  };
}

// `language` picks the index that is searched, not just the language of the answer:
// the English index holds only Latin names, so "София" finds nothing under `en`.
// The script the user typed in therefore decides where to look — someone typing
// Latin keeps their own language, whatever the interface is set to.
const CYRILLIC = /[Ѐ-ӿ]/;

export const searchLangFor = (query, lang) => (CYRILLIC.test(query) ? "bg" : lang);

// Open-Meteo localises place names via `language`.
export async function searchCities(query, lang) {
  const { results } = await fetch("https://geocoding-api.open-meteo.com/v1/search" +
    `?name=${encodeURIComponent(query)}&count=6&language=${searchLangFor(query, lang)}`).then(json);
  return results ?? [];
}

// Looks a known place up by id — the same record a search returns, which is what
// makes an id enough on its own: it carries the coordinates as well as the name.
export async function fetchPlace(id, lang) {
  return fetch(`https://geocoding-api.open-meteo.com/v1/get?id=${id}&language=${lang}`).then(json);
}

// The same lookup, when only the name in another language is wanted.
export async function fetchPlaceName(id, lang) {
  const place = await fetchPlace(id, lang);
  return [place.name, place.country].filter(Boolean).join(", ");
}

export async function fetchRadarFrame() {
  const index = await fetch("https://api.rainviewer.com/public/weather-maps.json").then(json);
  const frame = index.radar?.past?.at(-1);
  if (!frame) throw new Error("No radar frame available");
  return { url: `${index.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, time: frame.time * 1000 };
}
