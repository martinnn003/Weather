// Every endpoint here is free and needs no key.
const FORECAST =
  "&current=temperature_2m,weather_code,relative_humidity_2m,apparent_temperature," +
  "wind_speed_10m,wind_direction_10m,surface_pressure,precipitation,is_day" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max," +
  "wind_speed_10m_max,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum" +
  "&hourly=temperature_2m,weather_code,precipitation_probability,visibility,is_day" +
  "&timezone=auto&forecast_days=10";

const json = async res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// The forecast is required; air quality is a bonus that must never break it.
export async function fetchWeather(lat, lon) {
  const [weather, air] = await Promise.allSettled([
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}${FORECAST}`).then(json),
    fetch("https://air-quality-api.open-meteo.com/v1/air-quality" +
      `?latitude=${lat}&longitude=${lon}&current=european_aqi&timezone=auto`).then(json)
  ]);
  if (weather.status === "rejected") throw weather.reason;
  return {
    data: weather.value,
    aqi: air.status === "fulfilled" ? air.value?.current?.european_aqi ?? null : null
  };
}

// Open-Meteo localises place names via `language`.
export async function searchCities(query, lang) {
  const { results } = await fetch("https://geocoding-api.open-meteo.com/v1/search" +
    `?name=${encodeURIComponent(query)}&count=6&language=${lang}`).then(json);
  return results ?? [];
}

// Looks a known place up again to get its name in another language.
export async function fetchPlaceName(id, lang) {
  const place = await fetch(`https://geocoding-api.open-meteo.com/v1/get?id=${id}&language=${lang}`).then(json);
  return [place.name, place.country].filter(Boolean).join(", ");
}

export async function fetchRadarFrame() {
  const index = await fetch("https://api.rainviewer.com/public/weather-maps.json").then(json);
  const frame = index.radar?.past?.at(-1);
  if (!frame) throw new Error("No radar frame available");
  return { url: `${index.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, time: frame.time * 1000 };
}
