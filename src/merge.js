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
  // rest are only ever read for the hour that is now — all but CAPE, which goes with the
  // code, so a storm is weighed by the instability of the model that called it. The
  // models' own weather code is not shown as it comes; the icons below are built from the
  // merged readings, and the code is consulted only for what those cannot tell, a storm or fog.
  switched: ["weather_code", "cape", "visibility", "is_day", "pressure_msl"],
  // Readings of the moment, which "now" reads between the hour it falls in and the next,
  // by the minute, as Open-Meteo does wherever no model has 15-minute steps. Gusts, rain
  // and its chance are the preceding hour's peak or sum, and stay the hour's; so do the
  // weather code, which has no halfway, and the wind's bearing.
  instant: ["temperature_2m", "apparent_temperature", "relative_humidity_2m",
    "cloud_cover", "cloud_cover_low", "wind_speed_10m", "visibility", "pressure_msl"],
  icons: {
    // mm: an hour from this much on, or a day from this much on, shows falling weather.
    wetHour: 0.1,
    wetDay: 0.1,
    // % cloud cover: under 20 clear, under 50 mostly clear, up to 80 partly cloudy, over it overcast.
    clouds: [20, 50, 80],
    // Rain or snow by its water, mm an hour: light under 1, heavy from 2.5, moderate
    // between. The icons draw one, three and five drops or flakes for the three.
    rainRates: [1, 2.5],
    // A day's rain or snow by its total water, mm: light under 5, heavy from 15, moderate between.
    dayRain: [5, 15],
    // °C, the temperature shown: at or below the first, whatever falls is snow; from the
    // second on, rain; between them ECMWF says how much of it is which.
    snowTemps: [0, 3],
    // The share of the water that falls as snow: under the first it rains, from the second
    // on it snows, and between them it rains and snows together.
    mixShares: [0.25, 0.75],
    // Local hours, both included, whose mean cloud cover is a dry day's sky.
    daytime: [8, 18],
    // J/kg of CAPE, from which a model's storm is believed. ICON Global calls thunder in
    // air with next to none: its forecast for 23 October 2026 had one at midnight at
    // 10 J/kg, and that one hour made the whole day a storm. A year of its forecasts for
    // Sofia (October 2025 on) had nine storm days; below 100 fell November's, January's and
    // one of May's two, and all of summer's stood.
    stormCape: 100
  },
  // How ?debug=1 names a reading's origin.
  labels: { icon: "ICON Global", ecmwf: "IFS", blend: "ICON Global→IFS" }
};

// WMO codes from here up all fall from the sky: drizzle, rain, snow, showers, storms.
const FALLING = 51;
const isStorm = code => code >= 95 && code <= 99;
// Rain and snow together, light, moderate and heavy. Open-Meteo's codes have none; WMO's
// full table has 68 and 69 for it, light and the rest, and 84 for heavy showers of it.
const RAIN_AND_SNOW = [68, 69, 84];
const isFog = code => code === 45 || code === 48;

const sky = cover => {
  const [clear, mostly, partly] = MERGE.icons.clouds;
  if (cover < clear) return 0;
  if (cover < mostly) return 1;
  return cover <= partly ? 2 : 3;
};

// How hard rain or snow falls, 0 light to 2 heavy, from its millimetres of water and the
// two lines between the grades: `rainRates` for an hour's, `dayRain` for a day's total.
// Snow is graded by its water, not its depth, so its icon agrees with the millimetres
// printed under it, as rain's does.
const rainGrade = (rain, [light, heavy]) => (rain < light ? 0 : rain < heavy ? 1 : 2);

// Open-Meteo's snowfall, in cm, is 0.7 of its water in mm.
const SNOW_CM_A_MM = 0.7;

// The share, 0 to 1, of `rain` mm of water that falls as snow, from ECMWF's `snow` cm of
// it and the hour's `temp`, in °C. ECMWF tells rain from snow at the height of its own
// ground, which under a peak is far lower than the peak, while the temperature shown is
// brought to the place's own height: Musala, 2925 m up, is in a cell of 1985 m, which on
// 3 November 2026 rained at +1.5 °C under a peak of -3.6. So the temperature decides at
// either end of `snowTemps`, and ECMWF's split only between them.
function snowShare(rain, snow, temp) {
  const [cold, warm] = MERGE.icons.snowTemps;
  if (temp != null && temp <= cold) return 1;
  if (temp != null && temp >= warm) return 0;
  return rain > 0 && snow > 0 ? Math.min(1, snow / SNOW_CM_A_MM / rain) : 0;
}

// `grade` is how hard it falls, from `rainGrade`; `share` how much of it is snow, from
// `snowShare`, which `mixShares` makes rain, rain and snow, or snow. `cover` is the sky's
// cloud cover, in %: rain or snow from a sky with breaks in it falls as showers, the only
// falling weather drawn with a sun, and from an overcast one, or an unknown one, as rain
// or snow. Choosing showers by sky rather than by rate is the point: nearly every wet hour
// is light, and choosing by rate once put a sun into overcast and into the middle of the
// night. Rain and snow together falls at 0 to 3 °C, nearly always from a closed sky, and
// has no showers.
const falling = (grade, share, cover) => {
  const [mixed, snowy] = MERGE.icons.mixShares;
  const showers = cover != null && sky(cover) < 3;
  if (share >= snowy) return (showers ? [85, 86, 75] : [71, 73, 75])[grade];
  if (share >= mixed) return RAIN_AND_SNOW[grade];
  return (showers ? [80, 81, 82] : [61, 63, 65])[grade];
};

// One hour's icon. Whether anything falls is the merged rain's to say, so an icon can no
// longer rain over a dry hour or shine over a wet one; snow is ECMWF's snowfall, held to
// the hour's temperature `temp` by `snowShare`, and the
// sky, dry or wet, is the merged cloud cover. The model's code is kept only where the
// readings are silent: a storm, if something is falling and the air has the CAPE for one
// (or no CAPE came to judge by), and fog, if nothing is falling.
function hourCode(model, rain, snow, temp, cover, cape) {
  if (rain == null) return model; // nothing to hold the model to
  if (rain >= MERGE.icons.wetHour) {
    const storm = isStorm(model) && (cape == null || cape >= MERGE.icons.stormCape);
    if (storm) return model;
    return falling(rainGrade(rain, MERGE.icons.rainRates), snowShare(rain, snow, temp), cover);
  }
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
// the day's total, snow if ECMWF had any, a storm if one of its wet hours was one, the
// total again for how hard, rain or snow, and its daytime sky for showers or rain. Graded
// by its heaviest hour, a day of light rain from morning to night, 18 mm, drew lighter
// rain than one hour of 3 mm; graded by the total, the icon agrees with the millimetres
// printed under it, and 5 and 15 mm of water are about 5 and 15 cm of snow. That sky,
// the mean cloud cover over `daytime`, is also a dry day's icon, unless fog held most of those
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
    // The day's snow is its hours' snow, each held to its own temperature.
    let water = 0, snow = 0;
    for (const i of hours) {
      const wet = hourly.precipitation[i];
      if (!(wet > 0)) continue;
      water += wet;
      snow += wet * snowShare(wet, hourly.snowfall[i], hourly.temperature_2m[i]);
    }
    return falling(rainGrade(rain, MERGE.icons.dayRain), water ? snow / water : 0, cover);
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
    hourly.snowfall[i], hourly.temperature_2m[i], hourly.cloud_cover[i], hourly.cape[i]));

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
  const columns = ["temperature_2m_max", "temperature_2m_min", "wind_speed_10m_max",
    "wind_gusts_10m_max", "wind_direction_10m_dominant",
    "precipitation_sum", "precipitation_probability_max", "uv_index_max", "weather_code"];
  for (const column of columns) daily[column] = [];

  for (const date of raw.daily.time) {
    const hours = [];
    times.forEach((time, i) => { if (time.startsWith(date)) hours.push(i); });
    const read = name => hours.map(i => hourly[name][i]).filter(v => v != null);
    const rain = sum(read("precipitation"));

    daily.temperature_2m_max.push(max(read("temperature_2m")));
    daily.temperature_2m_min.push(min(read("temperature_2m")));
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
