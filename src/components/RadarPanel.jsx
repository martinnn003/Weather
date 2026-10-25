import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchRadarFrame } from "../api.js";
import { useSettings } from "../settings.jsx";

// Loaded lazily: nobody downloads Leaflet unless they open the radar.
export default function RadarPanel({ lat, lon, onShown }) {
  const { dict } = useSettings();
  const panelRef = useRef(null);
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const [frameTime, setFrameTime] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const map = L.map(boxRef.current, { attributionControl: true }).setView([lat, lon], 7);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 12,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    mapRef.current = map;

    let cancelled = false;
    fetchRadarFrame()
      .then(frame => {
        if (cancelled) return;
        L.tileLayer(frame.url, { opacity: 0.65, maxZoom: 12, attribution: "RainViewer" }).addTo(map);
        setFrameTime(frame.time);
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; following the city is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { mapRef.current?.setView([lat, lon], 7); }, [lat, lon]);

  // The map's box has its height from the start, so the panel already stands where it
  // will stay and can be scrolled to as soon as it is drawn.
  useEffect(() => { onShown?.(panelRef.current); }, [onShown]);

  const caption = failed
    ? dict.radarFailed
    : frameTime
      ? dict.radarTime(new Date(frameTime).toLocaleTimeString(dict.locale,
          { hour: "2-digit", minute: "2-digit" }))
      : dict.radarLoading;

  return (
    // The margins keep it clear of the sticky navbar, which wraps to three rows on a
    // phone, and of the bottom edge of the screen. On a phone the bottom one is taller
    // than all that is left below the panel, so the scroll runs on to the end of the
    // page: the only place where the button to the top covers no attribution, the map's
    // or the footer's.
    <section ref={panelRef} aria-label={dict.radarLabel}
      className="panel enter scroll-mt-44 scroll-mb-40 sm:scroll-mt-24 sm:scroll-mb-6">
      <div className="mb-3 text-sm opacity-80">{caption}</div>
      <div ref={boxRef} className="radar-map h-[260px] overflow-hidden rounded-2xl sm:h-[340px] xl:h-[400px]" />
    </section>
  );
}
