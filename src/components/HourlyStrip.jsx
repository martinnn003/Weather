import { useEffect, useRef } from "react";
import { useSettings } from "../settings.jsx";
import { weatherFor } from "../weatherCodes.js";
import { hoursForDay, sparkGeometry, HOUR_W, HOUR_GAP } from "../hours.js";
import { timeStr } from "../format.js";

function Sparkline({ values }) {
  const geometry = sparkGeometry(values);
  if (!geometry) return null;
  const { width, height, line, area, markers } = geometry;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true" focusable="false" className="block">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      {markers.map(({ cx, cy }) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.5"
          fill="#fff" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
      ))}
    </svg>
  );
}

export default function HourlyStrip({ data, dayIndex }) {
  const { dict, lang, fmt } = useSettings();
  const scroller = useRef(null);
  const hours = hoursForDay(data, dayIndex);
  const nowIndex = hours.findIndex(hour => !hour.past);

  // Today opens on the current hour rather than at midnight; every other day opens at its
  // start. Switching days reuses this same node, so the position is always written -- left
  // alone, it would keep the offset the day before it scrolled to. Setting scrollLeft keeps
  // the move inside this panel; scrollIntoView would drag the page along with it.
  useEffect(() => {
    if (!scroller.current) return;
    scroller.current.scrollLeft = nowIndex > 0 ? nowIndex * (HOUR_W + HOUR_GAP) : 0;
  }, [dayIndex, nowIndex]);

  if (!hours.length) return null;

  return (
    <section aria-label={dict.hourlyLabel} className="panel enter">
      <div ref={scroller} className="scroll-x">
        <div className="flex w-max flex-col">
          {/* The curve is decorative: every value is labelled in its cell below. */}
          <Sparkline values={hours.map(hour => fmt.conv(hour.temp))} />
          <div className="flex" style={{ gap: `${HOUR_GAP}px` }}>
            {hours.map(hour => {
              const { icon, label } = weatherFor(hour.code, lang, hour.isDay);
              const time = timeStr(hour.time);
              const temp = fmt.temp(hour.temp);
              return (
                <div
                  key={hour.time}
                  title={`${time} · ${label ?? dict.unknown} · ${temp} · 💧${hour.rain}%`}
                  style={{ flex: `0 0 ${HOUR_W}px` }}
                  className={`rounded-lg bg-white/10 px-1 py-2.5 text-center transition-colors
                    hover:bg-white/20 ${hour.past ? "opacity-45" : ""}`}
                >
                  <div className="text-xs opacity-75">{time}</div>
                  <div className="my-1.5 text-xl">{icon}</div>
                  <div className="text-sm font-semibold">{temp}</div>
                  <div className="mt-1 text-[0.7rem] opacity-80">💧{hour.rain}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
