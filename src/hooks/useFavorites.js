import { useCallback, useEffect, useState } from "react";
import { samePlace } from "../place.js";

const read = () => {
  try {
    const saved = JSON.parse(localStorage.getItem("favorites") || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

export function useFavorites() {
  const [favorites, setFavorites] = useState(read);

  useEffect(() => { localStorage.setItem("favorites", JSON.stringify(favorites)); }, [favorites]);

  const toggle = useCallback(place => {
    setFavorites(list => (list.some(f => samePlace(f, place))
      ? list.filter(f => !samePlace(f, place))
      : [...list, place]));
  }, []);

  const remove = useCallback(index => {
    setFavorites(list => list.filter((_, i) => i !== index));
  }, []);

  return { favorites, toggle, remove };
}
