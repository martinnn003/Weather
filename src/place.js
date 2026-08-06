// A "place" is what the app is showing: coordinates plus how to name them.
//   labelKey — a built-in name ("myLocation", "defaultCity"), translated locally
//   geoId    — an Open-Meteo place id, so the name can be re-fetched per language
//   label    — the name as it was found; the fallback while a translation loads
export const DEFAULT_PLACE = { lat: 42.7, lon: 23.32, label: "", labelKey: "defaultCity", geoId: null };

export const placeFromCity = city => ({
  lat: Number(city.latitude), lon: Number(city.longitude),
  label: [city.name, city.country].filter(Boolean).join(", "),
  labelKey: null, geoId: city.id ?? null
});

export function placeFromUrl(search) {
  const params = new URLSearchParams(search);
  const lat = params.get("lat");
  const lon = params.get("lon");
  if (!lat || !lon) return null;
  return {
    lat: Number(lat), lon: Number(lon),
    label: params.get("city") || `${lat}, ${lon}`,
    labelKey: params.get("key"), geoId: params.get("id")
  };
}

export function loadPlace() {
  try {
    const saved = JSON.parse(localStorage.getItem("lastCity") || "null");
    return saved?.lat != null && saved?.lon != null ? saved : null;
  } catch {
    return null;
  }
}

export const savePlace = place => localStorage.setItem("lastCity", JSON.stringify(place));

// Keeps the address bar shareable: it always describes what is on screen.
export function syncUrl(place, name, lang, unit) {
  const query = new URLSearchParams({ lat: place.lat, lon: place.lon, lang, unit });
  if (place.geoId) query.set("id", place.geoId);
  if (place.labelKey) query.set("key", place.labelKey);
  else if (name) query.set("city", name);
  history.replaceState(null, "", `?${query}`);
}

// Same place if the ids match, or the coordinates are within ~5 km.
export function samePlace(a, b) {
  if (!a || !b) return false;
  if (a.geoId && b.geoId) return String(a.geoId) === String(b.geoId);
  return Math.abs(a.lat - b.lat) < 0.05 && Math.abs(a.lon - b.lon) < 0.05;
}
