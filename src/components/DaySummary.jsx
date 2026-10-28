import { useSettings } from "../settings.jsx";
import { iconUrl, weatherFor } from "../weatherCodes.js";
import { dayTiles, IN_DAY_ROW } from "../dayTiles.js";

// A phone's summary of the picked day, opened under its row and over its hours. On a wide
// screen the top panel turns into this summary, just above the days; on a phone that panel
// is a screen or more above the list, so the change would happen out of sight. Only what
// the row does not already say: its word for the weather, which a row has no room for, and
// the tiles it leaves out. A reading that is missing is left out, as in the panel.
export default function DaySummary({ data, dayIndex }) {
  const { dict, lang, fmt } = useSettings();
  const { label } = weatherFor(data.daily.weather_code[dayIndex], lang);
  const tiles = dayTiles(data, dayIndex, dict, fmt).filter(([icon]) => !IN_DAY_ROW.has(icon));

  return (
    <section aria-label={dict.daySummaryLabel} className="enter min-w-0 px-3">
      {/* The rule sits inside the inset, like the ones between the hours below it. */}
      <div className="border-b border-white/15 pt-1 pb-3">
        <div className="text-sm font-semibold">{label ?? dict.unknown}</div>
        {/* Three across: six tiles make two rows. A third of a 360px phone holds "100 km/h"
            on one line only at the small size, beside an icon pulled in close. */}
        <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-3">
          {tiles.map(([icon, tileLabel, value]) => (
            <div key={icon} className="min-w-0">
              <div className="flex items-center gap-0.5 text-sm font-semibold whitespace-nowrap">
                {/* Drawn large and pulled in, like the panel's: the square is mostly margin. */}
                <img src={iconUrl(icon)} alt="" className="-my-1.5 -ml-1.5 h-8 w-8 shrink-0" />
                {value}
              </div>
              <div className="truncate text-[0.7rem] opacity-75">{tileLabel}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
