import { timeStr } from "./format.js";

// A day's figures as tiles: [icon, label, value]. The top panel shows them all for a day
// ahead; a phone shows them under the day itself, less what the day's row already says.
// No feels-like among them: a day's warmest feel read as one figure for the whole day,
// and wind and damp come and go by the hour, so each hour says how it feels instead.
export function dayTiles(data, dayIndex, dict, fmt) {
  const { daily } = data;
  const gusts = daily.wind_gusts_10m_max?.[dayIndex];
  const windFrom = daily.wind_direction_10m_dominant?.[dayIndex];
  // UV runs out about five days ahead; a later day has none, and a 0 would claim a dark one.
  const uv = daily.uv_index_max?.[dayIndex];
  return [
    ["thermometer-warmer", dict.high, fmt.temp(daily.temperature_2m_max[dayIndex])],
    ["thermometer-colder", dict.low, fmt.temp(daily.temperature_2m_min[dayIndex])],
    ["wind", windFrom == null ? dict.wind : fmt.windLabel(windFrom), fmt.wind(daily.wind_speed_10m_max[dayIndex])],
    ...(gusts == null ? [] : [["windsock", dict.gusts, fmt.wind(gusts)]]),
    ...(uv == null ? [] : [["uv-index", dict.uv, fmt.num(uv)]]),
    ["umbrella", dict.precip, fmt.percent(daily.precipitation_probability_max[dayIndex] ?? 0)],
    ["raindrop-measure", dict.precipTotal, fmt.rain(daily.precipitation_sum[dayIndex] ?? 0)],
    ["sunrise", dict.sunrise, timeStr(daily.sunrise[dayIndex])],
    ["sunset", dict.sunset, timeStr(daily.sunset[dayIndex])]
  ];
}

// The tiles a day's row in the list already carries: the high and the low, the wind and
// the rainfall.
export const IN_DAY_ROW = new Set(["thermometer-warmer", "thermometer-colder", "wind", "raindrop-measure"]);
