import { useSettings } from "../settings.jsx";
import { weatherFor } from "../weatherCodes.js";
import { aqiBand, timeStr } from "../format.js";

// Today shows live readings; a selected future day shows that day's aggregates.
function tilesFor(data, aqi, dayIndex, dict, fmt) {
  const { current, daily, hourly } = data;

  if (dayIndex > 0) {
    const gusts = daily.wind_gusts_10m_max?.[dayIndex];
    const windFrom = daily.wind_direction_10m_dominant?.[dayIndex];
    return [
      ["⬆️", dict.high, fmt.temp(daily.temperature_2m_max[dayIndex])],
      ["⬇️", dict.low, fmt.temp(daily.temperature_2m_min[dayIndex])],
      ["🌡️", dict.feelsLike, fmt.temp(daily.apparent_temperature_max[dayIndex])],
      ["💨", windFrom == null ? dict.wind : fmt.windLabel(windFrom), fmt.wind(daily.wind_speed_10m_max[dayIndex])],
      ...(gusts == null ? [] : [["🌪️", dict.gusts, fmt.wind(gusts)]]),
      ["😎", dict.uv, Math.round(daily.uv_index_max[dayIndex] ?? 0)],
      ["🌧️", dict.precip, `${daily.precipitation_probability_max[dayIndex] ?? 0}%`],
      ["☔", dict.precipTotal, fmt.rain(daily.precipitation_sum[dayIndex] ?? 0)],
      ["🌅", dict.sunrise, timeStr(daily.sunrise[dayIndex])],
      ["🌇", dict.sunset, timeStr(daily.sunset[dayIndex])]
    ];
  }

  const nowIndex = Math.max(0, hourly.time.findIndex(time => time.startsWith(current.time.slice(0, 13))));
  const visibility = hourly.visibility?.[nowIndex];
  return [
    ["🌡️", dict.feelsLike, fmt.temp(current.apparent_temperature)],
    ["💧", dict.humidity, `${current.relative_humidity_2m}%`],
    ["💨", fmt.windLabel(current.wind_direction_10m), fmt.wind(current.wind_speed_10m)],
    ["🧭", dict.pressure, fmt.pressure(current.surface_pressure)],
    ...(visibility == null ? [] : [["👁️", dict.visibility, fmt.distance(visibility)]]),
    ["😎", dict.uv, Math.round(daily.uv_index_max[0] ?? 0)],
    ["🌧️", dict.precip, `${daily.precipitation_probability_max[0] ?? 0}%`],
    ...(aqi == null ? [] : [["🍃", `${dict.air} · ${dict.aqi[aqiBand(aqi)]}`, Math.round(aqi)]]),
    ["🌅", dict.sunrise, timeStr(daily.sunrise[0])],
    ["🌇", dict.sunset, timeStr(daily.sunset[0])]
  ];
}

export default function NowPanel({ data, aqi, name, selectedDay, saved, onToggleSave, onShare }) {
  const { dict, lang, fmt } = useSettings();
  const { current, daily } = data;
  const day = selectedDay ?? 0;
  const isDay = current.is_day === 1;

  const { icon, label } = day > 0
    ? weatherFor(daily.weather_code[day], lang)
    : weatherFor(current.weather_code, lang, isDay);

  // Read in UTC, like the forecast strip: a date means that day wherever the place is,
  // and parsing it pins it to UTC midnight, which a browser west of Greenwich would
  // otherwise read back as the day before.
  const subtitle = day > 0
    ? new Date(daily.time[day]).toLocaleDateString(dict.locale,
        { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    : dict.subtitle;

  const headline = day > 0
    ? fmt.temp(daily.temperature_2m_max[day])
    : fmt.temp(current.temperature_2m);

  return (
    <section className="panel enter">
      {/* Wide enough for a row, the reading and the tiles sit side by side; stacked and
          centred below that, where a row would squeeze both halves. */}
      <div className="flex flex-col items-center gap-6 text-center
        lg:flex-row lg:items-center lg:gap-10 lg:text-left">
        <div className="lg:w-[360px] lg:shrink-0 lg:border-r lg:border-white/15 lg:pr-10">
          {/* The buttons act on the city, so they stay on its row, pinned to the right
              edge of the column — the same place whatever the language, rather than
              trailing a subtitle whose length decides whether they fit. The name takes
              the rest and wraps under itself if it runs long, leaving them where they are. */}
          <div className="flex items-start justify-center gap-3 lg:justify-between">
            <h1 className="min-w-0 text-[1.7rem] font-bold text-balance">{name}</h1>
            <div className="flex shrink-0 gap-1.5 lg:mt-1">
              <button
                type="button"
                className="icon-btn icon-btn-sm"
                aria-pressed={saved}
                title={saved ? dict.favRemove : dict.favAdd}
                aria-label={saved ? dict.favRemove : dict.favAdd}
                onClick={onToggleSave}
              >
                {saved ? "★" : "☆"}
              </button>
              <button type="button" className="icon-btn icon-btn-sm" title={dict.shareLabel}
                aria-label={dict.shareLabel} onClick={onShare}>🔗</button>
            </div>
          </div>

          <p className="mt-1 text-sm opacity-80">{subtitle}</p>
          <div className="mt-4 text-6xl leading-none font-light sm:text-7xl">{headline}{fmt.unitLetter}</div>
          <div className="mt-1.5 opacity-90">{icon} {label ?? dict.unknown}</div>
        </div>

        <div className="tiles w-full min-w-0 lg:flex-1 lg:[&>*]:basis-[calc((100%-2.5rem)/5)]">
          {tilesFor(data, aqi, day, dict, fmt).map(([tileIcon, tileLabel, value]) => (
            <div key={tileLabel} className="tile">
              <div className="text-lg">{tileIcon}</div>
              <div className="mt-0.5 font-bold">{value}</div>
              <div className="mt-0.5 text-[0.7rem] opacity-75">{tileLabel}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
