import { useSettings } from "../settings.jsx";
import { weatherFor } from "../weatherCodes.js";

export default function Forecast({ data, selectedDay, onSelect }) {
  const { dict, lang, fmt } = useSettings();
  const { daily } = data;

  // A date arrives as "2026-08-07" and means that day wherever the place is. Parsing it
  // to a Date pins it to UTC midnight, which a browser west of Greenwich then reads back
  // as the day before — so the weekday is asked for in UTC, and the date is read off the
  // string itself.
  const nameFor = i => {
    if (i === 0) return dict.today;
    if (i === 1) return dict.tomorrow;
    return new Date(daily.time[i])
      .toLocaleDateString(dict.locale, { weekday: "short", timeZone: "UTC" });
  };

  // Weekday names come round again over ten days, so the date says which "Mon" this is.
  const dateFor = i => {
    const [, month, day] = daily.time[i].split("-");
    return dict.dateShort(Number(day), Number(month) - 1);
  };

  return (
    <section
      aria-label={dict.forecastLabel}
      className="panel enter grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(80px,1fr))]"
    >
      {daily.time.map((date, i) => {
        const { icon, label } = weatherFor(daily.weather_code[i], lang);
        const name = nameFor(i);
        const dayDate = dateFor(i);
        const hi = fmt.temp(daily.temperature_2m_max[i]);
        const lo = fmt.temp(daily.temperature_2m_min[i]);
        return (
          <div
            key={date}
            role="button"
            tabIndex={0}
            aria-pressed={selectedDay === i}
            aria-label={dict.dayAria(name, dayDate, label ?? dict.unknown, hi, lo)}
            onClick={() => onSelect(i)}
            onKeyDown={e => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              onSelect(i);
            }}
            className={`cursor-pointer rounded-2xl px-2 py-4 text-center transition
              hover:-translate-y-0.5 hover:bg-white/20 motion-reduce:hover:translate-y-0
              ${selectedDay === i ? "bg-white/30" : "bg-white/10"}`}
          >
            <div className="text-sm font-semibold">{name}</div>
            <div className="text-xs opacity-65">{dayDate}</div>
            <div className="mt-1.5 mb-2 text-2xl">{icon}</div>
            <div className="font-bold">{hi}</div>
            <div className="text-sm opacity-70">{lo}</div>
          </div>
        );
      })}
    </section>
  );
}
