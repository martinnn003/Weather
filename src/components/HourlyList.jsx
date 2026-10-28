import { useState } from "react";
import { useSettings } from "../settings.jsx";
import { weatherFor } from "../weatherCodes.js";
import { hoursForDay } from "../hours.js";
import { timeStr } from "../format.js";
import Drop from "./Drop.jsx";

// The phone's hours, opened in the day list under the day they belong to. The page there
// already scrolls down, so the hours run down too: all of them in reach of a thumb,
// instead of three and a half at a time in a strip that swipes across. A curve has no
// way to run down a list; the temperatures read top to bottom show the turn of the day.
// Rules, not tiles: the day is the tile, its hours are lines inside it.
export default function HourlyList({ data, dayIndex }) {
  const { dict, lang, fmt } = useSettings();
  // Today's gone hours are kept, dimmed, as the strip keeps them, but folded away behind a
  // button: the strip scrolls past them by itself, and a list would leave that to the
  // reader. Folded every time it opens — another day, or today again, is a new list.
  const [showPast, setShowPast] = useState(false);
  const all = hoursForDay(data, dayIndex);
  const past = all.filter(hour => hour.past);
  const hours = showPast ? all : all.filter(hour => !hour.past);
  if (!hours.length) return null;
  const hourOf = hour => hour.time.slice(11, 13);

  return (
    <section aria-label={dict.hourlyLabel} className="enter min-w-0 px-3">
      {past.length > 0 && (
        <button
          type="button"
          aria-expanded={showPast}
          onClick={() => setShowPast(shown => !shown)}
          className="flex w-full items-center justify-center gap-1.5 py-2.5 text-xs opacity-75
            transition-opacity hover:opacity-100"
        >
          {showPast
            ? `▼ ${dict.hideEarlierHours}`
            : `▲ ${dict.earlierHours} (${hourOf(past[0])}–${hourOf(past.at(-1))})`}
        </button>
      )}
      {hours.map((hour, i) => {
        const { icon, label } = weatherFor(hour.code, lang, hour.isDay);
        const time = timeStr(hour.time);
        const temp = fmt.temp(hour.temp);
        const feels = hour.feels != null ? `${dict.feelsShort} ${fmt.temp(hour.feels)}` : null;
        // A missing reading stays blank: Math.round(null) would print a confident 0.
        const wind = hour.wind != null ? fmt.wind(hour.wind) : null;
        // A dry hour prints its 0.0 as a dry day does; only a missing one is left blank.
        const precip = hour.precip != null ? fmt.rain(hour.precip) : null;
        // The last column is the day row's, at the same inset, so each hour's wind stands
        // under the day's. The icon's column is narrower than the icon, whose square is
        // mostly margin, and the gaps are tight: on a 360px phone that is what gives the
        // temperature's column room for a winter's "усещ. -10°" beside the rain.
        return (
          <div
            key={hour.time}
            title={`${time} · ${label ?? dict.unknown} · ${temp}` + (feels ? ` (${feels})` : "")
              + ` · 💧${fmt.percent(hour.rain)}`
              + (precip ? ` · ${precip}` : "") + (wind ? ` · ${wind}` : "")}
            className={`grid grid-cols-[2.5rem_2rem_minmax(0,1fr)_3rem_4rem] items-center
              gap-x-1.5 py-2 text-sm ${i || past.length ? "border-t border-white/15" : ""}
              ${hour.past ? "opacity-45" : ""}`}
          >
            <div className="opacity-75">{time}</div>
            <img src={icon} alt={label ?? dict.unknown} className="-mx-1 -my-2 h-10 w-10 max-w-none" />
            {/* How the hour feels goes under its temperature, in the small type of the
                amount under its chance, so the row grows no taller. A missing one is blank. */}
            <div className="whitespace-nowrap">
              <div className="font-semibold">{temp}</div>
              {feels && <div className="text-xs opacity-75">{feels}</div>}
            </div>
            {/* The amount goes under its chance: on one line the two do not fit a 360px
                phone without squeezing every column and the wind out from under the day's. */}
            <div className="text-xs whitespace-nowrap opacity-80">
              <div><Drop />{fmt.percent(hour.rain)}</div>
              {precip && <div>{precip}</div>}
            </div>
            <div className="text-xs whitespace-nowrap opacity-80">{wind}</div>
          </div>
        );
      })}
    </section>
  );
}
