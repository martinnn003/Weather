// Geometry of the hourly strip. HourlyStrip lays the cells out with these same two
// numbers, or the curve drifts away from the cells under it.
export const HOUR_W = 84;
export const HOUR_GAP = 8;
// The curve's usable band is `height - 24`, and its slopes read the same only while that
// band keeps pace with the horizontal scale. Widening a cell from 62 to 84 stretches an
// hour by a factor of 92/70, so the band goes from 30 to 40 and the height with it.
export const SPARK_H = 64;

// The 240 hourly readings, narrowed to one day. Today keeps its hours that have already
// passed, marked `past`: dropping them left a near-empty panel late in the evening and
// took the day's curve with it. The strip scrolls itself to the current hour instead.
export function hoursForDay(data, dayIndex) {
  const { hourly, daily, current } = data;
  const date = daily.time[dayIndex];
  const now = current.time.slice(0, 13);
  const rows = [];
  hourly.time.forEach((time, i) => {
    if (!time.startsWith(date)) return;
    rows.push({
      time,
      temp: hourly.temperature_2m[i],
      code: hourly.weather_code[i],
      isDay: hourly.is_day[i] === 1,
      rain: hourly.precipitation_probability[i],
      past: time.slice(0, 13) < now
    });
  });
  return rows;
}

// One series, so no legend: every value is labelled in the cell below the curve and
// only the day's high and low get a marker.
export function sparkGeometry(values, { cellW = HOUR_W, gap = HOUR_GAP, height = SPARK_H } = {}) {
  if (values.length < 2) return null;
  const step = cellW + gap;
  const width = values.length * step - gap;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const x = i => i * step + cellW / 2;
  const y = v => height - 10 - ((v - lo) / span) * (height - 24);

  let line = `M ${x(0)} ${y(values[0])}`;
  for (let i = 1; i < values.length; i++) {
    const mid = (x(i - 1) + x(i)) / 2; // horizontal tangents keep the curve calm
    line += ` C ${mid} ${y(values[i - 1])}, ${mid} ${y(values[i])}, ${x(i)} ${y(values[i])}`;
  }

  const markers = [values.indexOf(hi)];
  const loIndex = values.indexOf(lo);
  if (loIndex !== markers[0]) markers.push(loIndex);

  return {
    width,
    height,
    line,
    area: `${line} L ${x(values.length - 1)} ${height} L ${x(0)} ${height} Z`,
    markers: markers.map(i => ({ cx: x(i), cy: y(values[i]) }))
  };
}
