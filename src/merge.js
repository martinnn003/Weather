// The forecast comes from two models, each read where it is stronger, and is merged here
// into the one `current` / `hourly` / `daily` shape the rest of the app reads. Asked for
// two models at once, Open-Meteo answers with every hourly series twice, suffixed with
// each model's id; nothing outside this module ever sees those names.
export const MERGE = {
  // The ids as Open-Meteo's documentation spells them.
  icon: "dwd_icon_global", // DWD ICON Global: 11 km, seven and a half days, no visibility
  ecmwf: "ecmwf_ifs", // ECMWF IFS HRES: 9 km, fifteen days
  // The seam, in hours from the start of the series, which is 00:00 today, local time.
  // The blended readings are ICON Global's before `start` and ECMWF's from `end`, and slide
  // from one to the other in between, so no curve takes a step where the models meet.
  seam: { start: 96, end: 120 },
  blended: ["temperature_2m", "apparent_temperature", "relative_humidity_2m",
    "cloud_cover", "cloud_cover_low", "wind_gusts_10m"],
  // ECMWF's for all ten days. The chance of rain goes with the rain it is a chance of.
  ecmwfOnly: ["precipitation", "snowfall", "wind_speed_10m", "wind_direction_10m",
    "precipitation_probability"],
  // ICON Global's until the seam ends, ECMWF's after it: a category has no halfway, and the
  // rest are only ever read for the hour that is now. The models' own weather code is
  // not shown as it comes; the icons below are built from the merged readings, and the
  // code is consulted only for what those cannot tell, a storm or fog.
  switched: ["weather_code", "visibility", "is_day", "pressure_msl"],
  // Readings of the moment, which "now" reads between the hour it falls in and the next,
  // by the minute, as Open-Meteo does wherever no model has 15-minute steps. Gusts, rain
  // and its chance are the preceding hour's peak or sum, and stay the hour's; so do the
  // weather code, which has no halfway, and the wind's bearing.
  instant: ["temperature_2m", "apparent_temperature", "relative_humidity_2m",
    "cloud_cover", "cloud_cover_low", "wind_speed_10m", "visibility", "pressure_msl"],
  icons: {
    // mm: an hour from this much on, or a day from this much on, shows falling weather.
    wetHour: 0.1,
    wetDay: 0.2,
    // % cloud cover: under 20 clear, under 50 mostly clear, up to 80 partly cloudy, over it overcast.
    clouds: [20, 50, 80],
    // Rain by its water, mm an hour: light under 2.5, heavy from 7.6, moderate between.
    rainRates: [2.5, 7.6],
    // Snow by its depth, cm an hour: light under 1.3, moderate up to 2.5, heavy above it.
    snowRates: [1.3, 2.5],
    // Local hours, both included, whose mean cloud cover is a dry day's sky.
    daytime: [8, 18]
  },
  // How ?debug=1 names a reading's origin.
  labels: { icon: "ICON Global", ecmwf: "IFS", blend: "ICON Global→IFS" }
};

// WMO codes from here up all fall from the sky: drizzle, rain, snow, showers, storms.
const FALLING = 51;
const isStorm = code => code >= 95 && code <= 99;
const isFog = code => code === 45 || code === 48;

const sky = cover => {
  const [clear, mostly, partly] = MERGE.icons.clouds;
  if (cover < clear) return 0;
  if (cover < mostly) return 1;
  return cover <= partly ? 2 : 3;
};

// `rain` is mm an hour of water, `snow` cm an hour of ECMWF's snowfall: any snow makes it
// snow, graded by its own depth, since a millimetre of water can fall as a centimetre of it.
// `cover` is the sky's cloud cover, in %: rain from a sky with breaks in it falls as
// showers, the only rain drawn with a sun, and from an overcast one, or an unknown one,
// as rain. Grading rain by sky rather than by rate is the point: nearly every wet hour is
// light, and grading by rate once put a sun into overcast and into the middle of the night.
const falling = (rain, snow, cover) => {
  if (snow > 0) {
    const [light, heavy] = MERGE.icons.snowRates;
    return snow < light ? 71 : snow <= heavy ? 73 : 75;
  }
  const [light, heavy] = MERGE.icons.rainRates;
  const grade = rain < light ? 0 : rain < heavy ? 1 : 2;
  const showers = cover != null && sky(cover) < 3;
  return (showers ? [80, 81, 82] : [61, 63, 65])[grade];
};

// One hour's icon. Whether anything falls is the merged rain's to say, so an icon can no
// longer rain over a dry hour or shine over a wet one; snow is ECMWF's snowfall, and the
// sky, dry or wet, is the merged cloud cover. The model's code is kept only where the
// readings are silent: a storm, if something is falling, and fog, if nothing is.
function hourCode(model, rain, snow, cover) {
  if (rain == null) return model; // nothing to hold the model to
  if (rain >= MERGE.icons.wetHour) return isStorm(model) ? model : falling(rain, snow, cover);
  if (isFog(model)) return model;
  if (cover != null) return sky(cover);
  return model != null && model < FALLING ? model : null;
}

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

// `share` of the way from a to b, to a tenth.
const lerp = (a, b, share) => Math.round((a + (b - a) * share) * 10) / 10;

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

// A day's icon, built like an hour's from the rain printed under it: falling weather from
// the day's total, snow if ECMWF had any, a storm if one of its wet hours was one, its
// heaviest hour for how hard, and its daytime sky for showers or rain. That sky, the mean
// cloud cover over `daytime`, is also a dry day's icon, unless fog held most of those
// hours: a foggy morning alone is not a foggy day.
function dayIcon(hours, hourly, rain) {
  const { wetDay, daytime: [from, to] } = MERGE.icons;
  const codes = hours.map(i => hourly.weather_code[i]).filter(code => code != null);
  if (rain == null) return max(codes); // no rain to judge by: the worst hour, as Open-Meteo has it
  const day = hours.filter(i => {
    const hour = Number(hourly.time[i].slice(11, 13));
    return hour >= from && hour <= to;
  });
  const covers = day.map(i => hourly.cloud_cover[i]).filter(v => v != null);
  const cover = covers.length ? covers.reduce((total, v) => total + v, 0) / covers.length : null;
  if (rain >= wetDay) {
    const storms = codes.filter(isStorm);
    if (storms.length) return max(storms);
    const hourRain = hours.map(i => hourly.precipitation[i]).filter(v => v != null);
    const hourSnow = hours.map(i => hourly.snowfall[i]).filter(v => v != null);
    return falling(max(hourRain), max(hourSnow), cover);
  }
  const fog = day.map(i => hourly.weather_code[i]).filter(isFog);
  if (fog.length * 2 > day.length) return max(fog);
  if (cover != null) return sky(cover);
  return max(codes.filter(code => code < FALLING));
}

// `air` is the air-quality answer, or null when it failed. Neither model carries UV, so
// UV is CAMS's from there; it reaches about five days, and past them a day has no UV
// rather than a guessed one.
export function mergeForecast(raw, air = null) {
  const { icon, ecmwf, seam, blended, ecmwfOnly, switched, instant } = MERGE;
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
      return [lerp(a, b, (i - seam.start) / (seam.end - seam.start)), "blend"];
    });
  }
  for (const name of ecmwfOnly) merge(name, (a, b) => prefer(b, "ecmwf", a, "icon"));
  for (const name of switched) {
    merge(name, (a, b, i) => (i < seam.end
      ? prefer(a, "icon", b, "ecmwf")
      : prefer(b, "ecmwf", a, "icon")));
  }

  const modelCode = hourly.weather_code;
  hourly.weather_code = times.map((_, i) => hourCode(modelCode[i], hourly.precipitation[i],
    hourly.snowfall[i], hourly.cloud_cover[i]));

  const uvAt = new Map((air?.hourly?.time ?? []).map((time, i) => [time, air.hourly.uv_index?.[i]]));
  hourly.uv_index = times.map(time => uvAt.get(time) ?? null);

  // With two models, Open-Meteo's own `current` is the first model's alone, so "now" is
  // read off the merged hours, at the quarter hour of its clock: a reading of the moment
  // between the hour it falls in and the next, the rest off its hour. Only the clock and
  // is_day are kept: both are the sun's, not a model's, and to the quarter hour.
  const hour = raw.current.time.slice(0, 13);
  const at = Math.max(0, times.findIndex(time => time.startsWith(hour)));
  const share = Number(raw.current.time.slice(14, 16)) / 60;
  const current = { time: raw.current.time };
  for (const name of [...blended, ...ecmwfOnly, ...switched]) {
    const [now, next] = [hourly[name][at], hourly[name][at + 1]];
    current[name] = instant.includes(name) && share && now != null && next != null
      ? lerp(now, next, share)
      : now;
  }
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

    daily.weather_code.push(dayIcon(hours, hourly, rain));
  }

  return { current, hourly, daily, sources };
}

// For ?debug=1: which model a day's readings of `name` came from, as "IFS" or, on a day
// that mixes, "ICON Global + IFS".
export function daySources(data, name, date) {
  const found = new Set();
  data.hourly.time.forEach((time, i) => {
    const source = data.sources?.[name]?.[i];
    if (source && time.startsWith(date)) found.add(MERGE.labels[source]);
  });
  return [...found].join(" + ") || "—";
}
