import { useEffect, useState } from "react";
import { fetchPlaceName } from "../api.js";

// Names come back from the geocoding API in the language they were searched in, so
// a place with an id gets its name re-fetched per language. Results are cached for
// the session; while a lookup is in flight the previous name stays visible.
const cache = new Map();

export function useGeoName(geoId, lang, fallback) {
  const key = geoId ? `${geoId}:${lang}` : null;
  const [name, setName] = useState(() => (key && cache.get(key)) || fallback);

  useEffect(() => {
    if (!key) {
      setName(fallback);
      return;
    }
    const cached = cache.get(key);
    if (cached) {
      setName(cached);
      return;
    }
    let cancelled = false;
    setName(fallback);
    fetchPlaceName(geoId, lang)
      .then(fetched => {
        cache.set(key, fetched);
        if (!cancelled) setName(fetched);
      })
      .catch(console.error); // keep the fallback name
    return () => { cancelled = true; };
  }, [key, geoId, lang, fallback]);

  return name;
}
