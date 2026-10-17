import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWeather } from "../api.js";

// Open-Meteo's now moves on every quarter hour, and the readings for now and the sky
// behind them move with it. Every time zone is offset by whole quarter hours, so the
// epoch's quarters are everyone's. The page asks a minute past each, so Open-Meteo has
// turned over too.
const QUARTER = 15 * 60 * 1000;
const SETTLE = 60 * 1000;
const quarterOf = time => Math.floor((time - SETTLE) / QUARTER);
const untilNext = () => QUARTER - ((Date.now() - SETTLE) % QUARTER);

// Loads the forecast for a place and refreshes it every quarter hour while the tab is
// in view, and when the tab comes back after a quarter hour has turned. A new place
// clears the old readings; a refresh of the same place keeps them on screen, so a
// background reload never flashes the placeholder.
export function useWeather(place) {
  const [state, setState] = useState({ data: null, aqi: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);
  const shownPlace = useRef(null);
  const fetchedAt = useRef(0);

  useEffect(() => {
    if (place.lat == null) return; // a slug link, still waiting for its coordinates
    const isNewPlace = shownPlace.current !== place;
    shownPlace.current = place;
    let cancelled = false;

    setState(prev => (isNewPlace
      ? { data: null, aqi: null, error: null, loading: true }
      : { ...prev, loading: true, error: null }));

    fetchWeather(place.lat, place.lon)
      .then(({ data, aqi }) => {
        if (cancelled) return;
        fetchedAt.current = Date.now();
        setState({ data, aqi, error: null, loading: false });
      })
      .catch(error => {
        if (cancelled) return;
        console.error(error);
        setState(prev => ({ ...prev, loading: false, error }));
      });

    return () => { cancelled = true; };
  }, [place, nonce]);

  const reload = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (!fetchedAt.current || quarterOf(Date.now()) === quarterOf(fetchedAt.current)) return;
      reload();
    };
    let timer;
    const tick = () => {
      refresh();
      timer = setTimeout(tick, untilNext());
    };
    timer = setTimeout(tick, untilNext());
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);

  return { ...state, reload };
}
