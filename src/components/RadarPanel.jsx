import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchRadarFrame } from "../api.js";
import { useSettings } from "../settings.jsx";

// Loaded lazily: nobody downloads Leaflet unless they open the radar.
export default function RadarPanel({ lat, lon }) {
  const { dict } = useSettings();
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

  const caption = failed
    ? dict.radarFailed
    : frameTime
      ? dict.radarTime(new Date(frameTime).toLocaleTimeString(dict.locale,
          { hour: "2-digit", minute: "2-digit" }))
      : dict.radarLoading;

  return (
    <section aria-label={dict.radarLabel} className="panel enter">
      <div className="mb-3 text-sm opacity-80">{caption}</div>
      <div ref={boxRef} className="radar-map h-[260px] overflow-hidden rounded-2xl sm:h-[340px]" />
    </section>
  );
}
