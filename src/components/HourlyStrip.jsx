import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "../settings.jsx";
import { weatherFor } from "../weatherCodes.js";
import { hoursForDay, sparkGeometry, HOUR_W, HOUR_GAP } from "../hours.js";
import { timeStr } from "../format.js";

const HOUR_STEP = HOUR_W + HOUR_GAP;

const stepFor = width => Math.max(1, Math.round(width / 2 / HOUR_STEP)) * HOUR_STEP;

// A scroll is a movement like any other on the page, so it follows the same preference.
const smooth = () =>
  (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

// Sits over the strip's edge: a fade that shows the hours carry on underneath, and the
// button that moves them. Both go when there is nothing left that way.
function StripArrow({ toward, spent, label, onClick }) {
  const start = toward < 0;
  return (
    <div
      aria-hidden={spent}
      className={`pointer-events-none absolute inset-y-8 hidden w-24 items-center transition-opacity
        duration-200 sm:flex ${spent ? "opacity-0" : "opacity-100"}
        ${start ? "left-8 justify-start bg-gradient-to-r" : "right-8 justify-end bg-gradient-to-l"}
        from-white/20 via-white/10 to-transparent`}
    >
      <button
        type="button"
        disabled={spent}
        title={label}
        aria-label={label}
        onClick={onClick}
        className="strip-arrow pointer-events-auto"
      >
        {start ? "‹" : "›"}
      </button>
    </div>
  );
}

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
  const [spent, setSpent] = useState({ start: true, end: true });

  // Which way there is still road left. Read after every move, and on a resize, since a
  // wider panel can swallow the whole remainder and leave both arrows with nothing to do.
  const readEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const far = el.scrollWidth - el.clientWidth;
    setSpent({ start: el.scrollLeft <= 1, end: el.scrollLeft >= far - 1 });
  }, []);

  const nudge = toward => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: toward * stepFor(el.clientWidth), behavior: smooth() });
  };

  // Today opens on the current hour rather than at midnight; every other day opens at its
  // start. Switching days reuses this same node, so the position is always written -- left
  // alone, it would keep the offset the day before it scrolled to. Setting scrollLeft keeps
  // the move inside this panel; scrollIntoView would drag the page along with it.
  useEffect(() => {
    if (!scroller.current) return;
    scroller.current.scrollLeft = nowIndex > 0 ? nowIndex * HOUR_STEP : 0;
    readEdges();
  }, [dayIndex, nowIndex, readEdges]);

  useEffect(() => {
    window.addEventListener("resize", readEdges);
    return () => window.removeEventListener("resize", readEdges);
  }, [readEdges]);

  if (!hours.length) return null;

  return (
    <section aria-label={dict.hourlyLabel} className="panel enter relative">
      <div ref={scroller} onScroll={readEdges} className="scroll-x">
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
                  className={`rounded-xl bg-white/10 px-2 py-3 text-center transition-colors
                    hover:bg-white/20 ${hour.past ? "opacity-45" : ""}`}
                >
                  <div className="text-sm opacity-75">{time}</div>
                  <div className="my-2 text-2xl">{icon}</div>
                  <div className="text-base font-semibold">{temp}</div>
                  <div className="mt-1 text-xs opacity-80">💧{hour.rain}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <StripArrow toward={-1} spent={spent.start} label={dict.earlierHours}
        onClick={() => nudge(-1)} />
      <StripArrow toward={1} spent={spent.end} label={dict.laterHours}
        onClick={() => nudge(1)} />
    </section>
  );
}
