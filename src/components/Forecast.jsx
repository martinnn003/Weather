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
        // Math.round(null) is 0, so a missing reading would read as a calm northerly
        // rather than as nothing at all. The row is left out instead of guessed at.
        const speed = daily.wind_speed_10m_max?.[i];
        const deg = daily.wind_direction_10m_dominant?.[i];
        const hasWind = speed != null && deg != null;
        // A dry day still says so: 0.0 mm is a reading, and reading it is how you tell
        // it apart from the days around it. Only a missing total is left out.
        const rain = daily.precipitation_sum?.[i];
        const hasRain = rain != null;
        return (
          <div
            key={date}
            role="button"
            tabIndex={0}
            aria-pressed={selectedDay === i}
            aria-label={dict.dayAria(name, dayDate, label ?? dict.unknown, hi, lo,
              hasWind && fmt.windDir(deg), hasWind && fmt.wind(speed),
              hasRain && fmt.rain(rain))}
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
            <div className="text-xs opacity-75">{dayDate}</div>
            <div className="mt-1.5 mb-2 text-2xl">{icon}</div>
            <div className="font-bold">{hi}</div>
            {/* Two rules doing two jobs: the short one separates readings of the same
                kind, so it reads as the dash in a range; the full-bleed one below ends
                the temperatures and opens the other measurements. White at a quarter
                is invisible on this gradient — these are set where a hairline registers. */}
            <div className="mx-auto my-1.5 h-px w-8 bg-white/50" />
            <div className="text-sm opacity-90">{lo}</div>
            {(hasWind || hasRain) && (
              <>
                <div className="-mx-2 my-2 h-px bg-white/40" />
                {/* Three weights of rule for three sizes of break: the short one joins
                    two readings of a kind, the full one above ends the temperatures, and
                    the pale one below holds two unlike measurements apart without claiming
                    that same weight. Ten tiles make a row of thirty hairlines, so the
                    smallest break is drawn fainter and spaced tighter than the one above
                    it — the hierarchy is carried by both the ink and the air. */}
                <div className="flex flex-col gap-1.5 text-xs opacity-80">
                  {/* The arrow says where the wind blows to, the same way it does in the
                      panel above; a tile is too narrow for the compass word beside it. */}
                  {hasWind && <div>{fmt.windArrow(deg)} {fmt.wind(speed)}</div>}
                  {/* A day whose wind went missing has nothing above the rule to divide. */}
                  {hasWind && hasRain && <div className="-mx-2 h-px bg-white/25" />}
                  {hasRain && <div>💧 {fmt.rain(rain)}</div>}
                </div>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
