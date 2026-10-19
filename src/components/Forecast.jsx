import { Fragment } from "react";
import { useSettings } from "../settings.jsx";
import { weatherFor } from "../weatherCodes.js";
import { daySources } from "../merge.js";
import { debugOn } from "../place.js";

// `detail` is set in under the picked day: on a phone, that day's hours.
export default function Forecast({ data, selectedDay, onSelect, detail }) {
  const { dict, lang, fmt } = useSettings();
  const { daily } = data;
  const debug = debugOn();

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

  // From sm up a day is a tile in a row of ten. Below it a tile would be a third of a phone
  // wide and four rows deep, so each day is a row of its own instead, laid out across:
  // name and date | icon | high and low | wind over rain. The columns after the name are
  // fixed, so the temperatures of all ten days stand in one column and compare at a glance.
  return (
    <section
      aria-label={dict.forecastLabel}
      className="panel enter grid grid-cols-1 gap-2 sm:gap-3
        sm:[grid-template-columns:repeat(auto-fit,minmax(80px,1fr))]"
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
          <Fragment key={date}>
            <div
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
              className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_auto_4.25rem_4rem]
                items-center gap-x-2 rounded-xl px-3 py-2.5 text-left transition
                sm:block sm:rounded-2xl sm:px-2 sm:py-4 sm:text-center
                hover:-translate-y-0.5 hover:bg-white/20 motion-reduce:hover:translate-y-0
                ${selectedDay === i ? "bg-white/30" : "bg-white/10"}`}
            >
              <div className="col-start-1 row-start-1 text-sm font-semibold max-sm:truncate">
                {name}
              </div>
              <div className="col-start-1 row-start-2 text-xs opacity-75 max-sm:truncate">
                {dayDate}
              </div>
              <div className="col-start-2 text-2xl [grid-row:1/3] sm:mt-1.5 sm:mb-2">{icon}</div>
              {/* In a row the high gets a box of its own, right-aligned, so the degree signs
                  line up down the list and every low starts at the same place. */}
              <div className="col-start-3 flex items-baseline gap-2 [grid-row:1/3] sm:block">
                <div className="w-8 shrink-0 text-right font-bold sm:w-auto sm:text-center">{hi}</div>
                {/* Two rules doing two jobs: the short one separates readings of the same
                    kind, so it reads as the dash in a range; the full-bleed one below ends
                    the temperatures and opens the other measurements. White at a quarter
                    is invisible on this gradient — these are set where a hairline registers.
                    A row has the width to set the two side by side, and needs neither. */}
                <div className="mx-auto my-1.5 hidden h-px w-8 bg-white/50 sm:block" />
                <div className="text-sm opacity-90">{lo}</div>
              </div>
              {(hasWind || hasRain) && (
                <div className="col-start-4 [grid-row:1/3]">
                  <div className="-mx-2 my-2 hidden h-px bg-white/40 sm:block" />
                  {/* Three weights of rule for three sizes of break: the short one joins
                      two readings of a kind, the full one above ends the temperatures, and
                      the pale one below holds two unlike measurements apart without claiming
                      that same weight. Ten tiles make a row of thirty hairlines, so the
                      smallest break is drawn fainter and spaced tighter than the one above
                      it — the hierarchy is carried by both the ink and the air. In a row the
                      two readings stand one above the other, and the line break parts them. */}
                  <div className="flex flex-col gap-1 text-xs opacity-80 max-sm:whitespace-nowrap
                    sm:gap-1.5">
                    {/* The arrow says where the wind blows to, the same way it does in the
                        panel above; a tile is too narrow for the compass word beside it. */}
                    {hasWind && <div>{fmt.windArrow(deg)} {fmt.wind(speed)}</div>}
                    {/* A day whose wind went missing has nothing above the rule to divide. */}
                    {hasWind && hasRain && <div className="-mx-2 hidden h-px bg-white/25 sm:block" />}
                    {hasRain && <div>💧 {fmt.rain(rain)}</div>}
                  </div>
                </div>
              )}
              {debug && (
                <div className="col-span-4 mt-2 text-[10px] leading-tight opacity-70">
                  <div>T: {daySources(data, "temperature_2m", date)}</div>
                  <div>P: {daySources(data, "precipitation", date)}</div>
                </div>
              )}
            </div>
            {selectedDay === i && detail}
          </Fragment>
        );
      })}
    </section>
  );
}
