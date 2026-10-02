// The forecast comes from two models, each read where it is stronger, and is merged here
// into the one `current` / `hourly` / `daily` shape the rest of the app reads. Asked for
// two models at once, Open-Meteo answers with every hourly series twice, suffixed with
// each model's id; nothing outside this module ever sees those names.
export const MERGE = {
  // The ids as Open-Meteo's documentation spells them.
  icon: "dwd_icon_eu", // DWD ICON-EU: 7 km, five days
  ecmwf: "ecmwf_ifs", // ECMWF IFS HRES: 9 km, fifteen days
  // The seam, in hours from the start of the series, which is 00:00 today, local time.
  // The blended readings are ICON-EU's before `start` and ECMWF's from `end`, and slide
  // from one to the other in between, so no curve takes a step where the models meet.
  seam: { start: 96, end: 120 },
  blended: ["temperature_2m", "apparent_temperature", "relative_humidity_2m",
    "cloud_cover", "cloud_cover_low", "wind_gusts_10m"],
  // ECMWF's for all ten days. The chance of rain goes with the rain it is a chance of.
  ecmwfOnly: ["precipitation", "wind_speed_10m", "wind_direction_10m", "precipitation_probability"],
  // ICON-EU's until the seam ends, ECMWF's after it: a category has no halfway, and the
  // rest are only ever read for the hour that is now.
  switched: ["weather_code", "visibility", "is_day", "pressure_msl"],
  // A day whose rain comes to less than this, in mm, keeps no rain in its icon.
  dryBelow: 0.2,
  // How ?debug=1 names a reading's origin.
  labels: { icon: "ICON-EU", ecmwf: "IFS", blend: "ICON-EU→IFS" }
};

// WMO codes from here up all fall from the sky: drizzle, rain, snow, showers, storms.
const FALLING = 51;

export function forecastQuery() {
  const { icon, ecmwf, blended, ecmwfOnly, switched } = MERGE;
  return `&hourly=${[...blended, ...ecmwfOnly, ...switched].join(",")}&models=${icon},${ecmwf}`;
}

// Either model stands in for the other wherever the other has nothing.
const prefer = (value, source, standIn, standInSource) => {
  if (value != null) return [value, source];
  if (standIn != null) return [standIn, standInSource];
  return [null, null];
};

const max = values => (values.length ? Math.max(...values) : null);
const min = values => (values.length ? Math.min(...values) : null);
// To a tenth, as the tiles print it, so the icon is judged by the number shown under it.
const sum = values => (values.length
  ? Math.round(values.reduce((total, v) => total + v, 0) * 10) / 10
  : null);

// Each hour's bearing as a vector as long as its speed, summed: a strong westerly
// outweighs a calm easterly, and 350° and 10° meet at 0°, not at 180°.
function dominant(bearings, speeds) {
  let x = 0;
  let y = 0;
  bearings.forEach((deg, k) => {
    if (deg == null) return;
    const weight = speeds[k] ?? 1;
    x += weight * Math.sin(deg * Math.PI / 180);
    y += weight * Math.cos(deg * Math.PI / 180);
  });
  if (!x && !y) return null;
  return (Math.round(Math.atan2(x, y) * 180 / Math.PI) + 360) % 360;
}

// `air` is the air-quality answer, or null when it failed. Neither model carries UV, so
// UV is CAMS's from there; it reaches about five days, and past them a day has no UV
// rather than a guessed one.
export function mergeForecast(raw, air = null) {
  const { icon, ecmwf, seam, blended, ecmwfOnly, switched, dryBelow } = MERGE;
  const times = raw.hourly.time;
  const hourly = { time: times };
  const sources = {};

  const merge = (name, choose) => {
    const fromIcon = raw.hourly[`${name}_${icon}`] ?? [];
    const fromEcmwf = raw.hourly[`${name}_${ecmwf}`] ?? [];
    hourly[name] = [];
    sources[name] = [];
    times.forEach((_, i) => {
      const [value, source] = choose(fromIcon[i] ?? null, fromEcmwf[i] ?? null, i);
      hourly[name].push(value);
      sources[name].push(source);
    });
  };

  for (const name of blended) {
    merge(name, (a, b, i) => {
      if (i < seam.start || b == null) return prefer(a, "icon", b, "ecmwf");
      if (i >= seam.end || a == null) return prefer(b, "ecmwf", a, "icon");
      const share = (i - seam.start) / (seam.end - seam.start);
      return [Math.round((a + (b - a) * share) * 10) / 10, "blend"];
    });
  }
  for (const name of ecmwfOnly) merge(name, (a, b) => prefer(b, "ecmwf", a, "icon"));
  for (const name of switched) {
    merge(name, (a, b, i) => (i < seam.end
      ? prefer(a, "icon", b, "ecmwf")
      : prefer(b, "ecmwf", a, "icon")));
  }

  const uvAt = new Map((air?.hourly?.time ?? []).map((time, i) => [time, air.hourly.uv_index?.[i]]));
  hourly.uv_index = times.map(time => uvAt.get(time) ?? null);

  // With two models, Open-Meteo's own `current` is the first model's alone, so "now" is
  // read off the merged hour it falls in. Only its clock and is_day are kept: both are
  // the sun's, not a model's, and to the quarter hour.
  const hour = raw.current.time.slice(0, 13);
  const at = Math.max(0, times.findIndex(time => time.startsWith(hour)));
  const current = { time: raw.current.time };
  for (const name of [...blended, ...ecmwfOnly, ...switched]) current[name] = hourly[name][at];
  current.is_day = raw.current.is_day ?? hourly.is_day[at];
  current.uv_index = air?.current?.uv_index ?? null;

  // The day's figures are the merged hours' own, never one model's daily block, so the
  // high in a tile is the top of the curve beneath it.
  const daily = { time: raw.daily.time };
  for (const name of ["sunrise", "sunset"]) {
    daily[name] = raw.daily.time.map((_, d) =>
      raw.daily[`${name}_${icon}`]?.[d] ?? raw.daily[`${name}_${ecmwf}`]?.[d] ?? null);
  }
  const columns = ["temperature_2m_max", "temperature_2m_min", "apparent_temperature_max",
    "wind_speed_10m_max", "wind_gusts_10m_max", "wind_direction_10m_dominant",
    "precipitation_sum", "precipitation_probability_max", "uv_index_max", "weather_code"];
  for (const column of columns) daily[column] = [];

  for (const date of raw.daily.time) {
    const hours = [];
    times.forEach((time, i) => { if (time.startsWith(date)) hours.push(i); });
    const read = name => hours.map(i => hourly[name][i]).filter(v => v != null);
    const rain = sum(read("precipitation"));

    daily.temperature_2m_max.push(max(read("temperature_2m")));
    daily.temperature_2m_min.push(min(read("temperature_2m")));
    daily.apparent_temperature_max.push(max(read("apparent_temperature")));
    daily.wind_speed_10m_max.push(max(read("wind_speed_10m")));
    daily.wind_gusts_10m_max.push(max(read("wind_gusts_10m")));
    daily.wind_direction_10m_dominant.push(dominant(
      hours.map(i => hourly.wind_direction_10m[i]), hours.map(i => hourly.wind_speed_10m[i])));
    daily.precipitation_sum.push(rain);
    daily.precipitation_probability_max.push(max(read("precipitation_probability")));
    // UV that runs out partway through a day may have seen only its night, and would call
    // a sunny day's peak 0; the day gets a peak only when every one of its hours has a reading.
    const uv = hours.map(i => hourly.uv_index[i]);
    daily.uv_index_max.push(uv.includes(null) ? null : max(uv));

    // The worst hour, as Open-Meteo has it, unless the day stays dry: ICON-EU can paint a
    // shower that ECMWF's rainfall, the figure printed under the icon, never delivers.
    const codes = read("weather_code");
    let code = max(codes);
    if (code >= FALLING && rain != null && rain < dryBelow) {
      code = max(codes.filter(c => c < FALLING)) ?? 3;
    }
    daily.weather_code.push(code);
  }

  return { current, hourly, daily, sources };
}

// For ?debug=1: which model a day's readings of `name` came from, as "IFS" or, on a day
// that mixes, "ICON-EU + IFS".
export function daySources(data, name, date) {
  const found = new Set();
  data.hourly.time.forEach((time, i) => {
    const source = data.sources?.[name]?.[i];
    if (source && time.startsWith(date)) found.add(MERGE.labels[source]);
  });
  return [...found].join(" + ") || "—";
}
