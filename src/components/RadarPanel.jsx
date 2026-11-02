import { useEffect, useRef } from "react";
import { useSettings } from "../settings.jsx";

// Windy's embedded map: the rain ECMWF forecasts, from now on through seven days (the
// free embed locks the rest behind Premium), in three-hour steps, with a timeline and a
// play button of its own. Zoom 6 takes in Bulgaria with its neighbours, enough to see
// where a front comes from and where it goes. The map is
// centred on the city, with no marker or detail on it: Windy's detail is a box over the
// city that hides the map around it, and on a phone the zoom buttons too. The units and
// the language follow the page's.
export function windyUrl(lat, lon, lang, unit) {
  const imperial = unit === "f";
  return "https://embed.windy.com/embed.html?" + new URLSearchParams({
    type: "map",
    location: "coordinates",
    lat, lon,
    zoom: 6,
    level: "surface",
    overlay: "rain",
    product: "ecmwf",
    calendar: "now",
    message: "true", // hides the banner across the top of the map
    lang,
    metricRain: imperial ? "in" : "mm",
    metricTemp: imperial ? "°F" : "°C",
    metricWind: imperial ? "mph" : "km/h"
  });
}

export default function RadarPanel({ lat, lon, onShown }) {
  const { dict, lang, unit } = useSettings();
  const panelRef = useRef(null);

  // The map's box has its height from the start, so the panel already stands where it
  // will stay and can be scrolled to as soon as it is drawn.
  useEffect(() => { onShown?.(panelRef.current); }, [onShown]);

  return (
    // The margins keep it clear of the sticky navbar, which wraps to three rows on a
    // phone, and of the bottom edge of the screen. On a phone the bottom one is taller
    // than all that is left below the panel, so the scroll runs on to the end of the
    // page: the only place where the button to the top covers no attribution, the map's
    // or the footer's.
    <section ref={panelRef} aria-label={dict.radarLabel}
      className="panel enter scroll-mt-44 scroll-mb-40 sm:scroll-mt-24 sm:scroll-mb-6">
      <div className="mb-3 text-sm opacity-80">{dict.radarCaption}</div>
      <iframe title={dict.radarLabel} src={windyUrl(lat, lon, lang, unit)}
        className="block h-[380px] w-full rounded-2xl border-0 bg-[#263543] sm:h-[480px] xl:h-[560px]" />
    </section>
  );
}
