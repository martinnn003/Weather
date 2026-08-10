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

// A city lives at /plovdiv-bulgaria-728193. Only the trailing id is read: the words
// in front are decoration, so a slug that is stale, misspelt or translated still
// arrives at the right city.
const SLUG = /^\/(?:(.+)-)?(\d+)$/;

// Cyrillic is transliterated on the way into the address bar — the words are there to
// be read at a glance in a chat window, and percent-encoding turns them into noise.
const LATIN = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya"
};

const slugify = name => name.toLowerCase()
  .normalize("NFD").replace(/\p{M}/gu, "") // München → munchen, Й → и
  .replace(/[Ѐ-ӿ]/g, letter => LATIN[letter] ?? "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

export const pathFor = (place, name) => (place.geoId
  ? `/${[slugify(name || place.label || ""), place.geoId].filter(Boolean).join("-")}`
  : "/");

// A hand-mangled address must not take the page down with it.
const decode = path => { try { return decodeURIComponent(path); } catch { return path; } };

export function placeFromUrl(pathname, search) {
  const slug = SLUG.exec(decode(pathname || ""));
  if (slug) {
    // No coordinates in the link; the id is looked up once, on the way in. The slug
    // words stand in as the label so the address does not flicker while that happens.
    const [, words, geoId] = slug;
    return { lat: null, lon: null, label: words ?? "", labelKey: null, geoId };
  }
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

// Keeps the address bar shareable: it always describes what is on screen. A searched
// city has an id and so gets a path of its own; "my location" and old shared links
// have none, and keep naming themselves in the query string. Home is the exception —
// it is what the site shows without being asked, so there is nothing to describe and
// the bare address stays bare. Language and unit live in storage too, so dropping them
// there costs the reader nothing; only a link shared from the home page arrives in the
// reader's own language rather than the sender's.
export function syncUrl(place, name, lang, unit) {
  if (place.labelKey === "defaultCity" && samePlace(place, DEFAULT_PLACE)) {
    history.replaceState(null, "", "/");
    return;
  }
  const query = new URLSearchParams({ lang, unit });
  if (!place.geoId) {
    query.set("lat", place.lat);
    query.set("lon", place.lon);
    if (place.labelKey) query.set("key", place.labelKey);
    else if (name) query.set("city", name);
  }
  history.replaceState(null, "", `${pathFor(place, name)}?${query}`);
}

// Same place if the ids match, or the coordinates are within ~5 km.
export function samePlace(a, b) {
  if (!a || !b) return false;
  if (a.geoId && b.geoId) return String(a.geoId) === String(b.geoId);
  return Math.abs(a.lat - b.lat) < 0.05 && Math.abs(a.lon - b.lon) < 0.05;
}
