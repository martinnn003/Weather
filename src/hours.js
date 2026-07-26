// Geometry of the hourly strip. These two must match `.hour`'s width and the gap
// between cells in index.css, or the curve drifts away from the cells under it.
export const HOUR_W = 62;
export const HOUR_GAP = 8;
export const SPARK_H = 54;

// The 240 hourly readings, narrowed to one day. For today, hours already past are
// dropped so the strip opens on the current hour instead of at midnight.
export function hoursForDay(data, dayIndex) {
  const { hourly, daily, current } = data;
  const date = daily.time[dayIndex];
  const from = dayIndex === 0 ? current.time.slice(0, 13) : "";
  const rows = [];
  hourly.time.forEach((time, i) => {
    if (time.startsWith(date) && time.slice(0, 13) >= from) {
      rows.push({
        time,
        temp: hourly.temperature_2m[i],
        code: hourly.weather_code[i],
        isDay: hourly.is_day[i] === 1,
        rain: hourly.precipitation_probability[i]
      });
    }
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
