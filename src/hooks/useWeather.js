import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWeather } from "../api.js";

const MAX_AGE = 30 * 60 * 1000;

// Loads the forecast for a place and refreshes it when the tab comes back after the
// data has gone stale. A new place clears the old readings; a refresh of the same
// place keeps them on screen, so a background reload never flashes the placeholder.
export function useWeather(place) {
  const [state, setState] = useState({ data: null, aqi: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);
  const shownPlace = useRef(null);
  const fetchedAt = useRef(0);

  useEffect(() => {
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
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!fetchedAt.current || Date.now() - fetchedAt.current < MAX_AGE) return;
      reload();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [reload]);

  return { ...state, reload };
}
