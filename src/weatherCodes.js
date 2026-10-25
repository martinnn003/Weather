// The icons are Meteocons, by Bas Milius (MIT, see icons/LICENSE): the fill set of
// @meteocons/svg 3.0.0-next.10, held still. Animated, ten days and a day's hours would all
// be moving at once, and a falling drop cannot be counted. Counting is the point: rain and
// snow fall from one drop or flake when light, three when moderate, and five under a dark
// cloud when heavy. Meteocons draws every grade with three, so those counts are this
// app's own, and so are the drops' lighter blue and the flakes' size, which the page's
// dark backgrounds swallowed. The navbar, the top panel's tiles and buttons and the drop
// beside every chance and amount of rain take their icons from the same folder, by name;
// theirs are lightened the same way, and the arrows under sunrise and sunset, the air's
// leaves, lifted from grid-eco, the saved city's yellow star, the link, the pin and the
// radar are the app's too.
const ICONS = import.meta.glob("./icons/*.svg", { eager: true, query: "?url", import: "default" });
export const iconUrl = name => ICONS[`./icons/${name}.svg`];

// WMO weather codes → icons plus a label per language. `night` is optional and only
// differs where the day's icon has a sun in it. The sun goes into falling weather only for
// showers, which fall between breaks in the sky; drizzle and rain fall from a closed one.
export const CODES = {
  0:  { icon: "clear-day", night: "clear-night", en: "Clear skies", bg: "Ясно" },
  1:  { icon: "mostly-clear-day", night: "mostly-clear-night", en: "Mostly clear", bg: "Предимно ясно" },
  2:  { icon: "partly-cloudy-day", night: "partly-cloudy-night", en: "Partly cloudy", bg: "Частична облачност" },
  3:  { icon: "overcast",      en: "Overcast",           bg: "Плътна облачност" },
  45: { icon: "fog",           en: "Fog",                bg: "Мъгла" },
  48: { icon: "fog",           en: "Rime fog",           bg: "Ледена мъгла" },
  51: { icon: "drizzle",       en: "Light drizzle",      bg: "Слаб дъждец" },
  53: { icon: "drizzle",       en: "Drizzle",            bg: "Дъждец" },
  55: { icon: "drizzle",       en: "Heavy drizzle",      bg: "Силен дъждец" },
  56: { icon: "drizzle",       en: "Freezing drizzle",   bg: "Заледяващ дъждец" },
  57: { icon: "drizzle",       en: "Freezing drizzle",   bg: "Заледяващ дъждец" },
  61: { icon: "rain-1",        en: "Light rain",         bg: "Слаб дъжд" },
  63: { icon: "rain-3",        en: "Rain",               bg: "Дъжд" },
  65: { icon: "rain-5",        en: "Heavy rain",         bg: "Силен дъжд" },
  66: { icon: "rain-1",        en: "Freezing rain",      bg: "Заледяващ дъжд" },
  67: { icon: "rain-5",        en: "Freezing rain",      bg: "Заледяващ дъжд" },
  71: { icon: "snow-1",        en: "Light snow",         bg: "Слаб снеговалеж" },
  73: { icon: "snow-3",        en: "Snow",               bg: "Снеговалеж" },
  75: { icon: "snow-5",        en: "Heavy snow",         bg: "Силен снеговалеж" },
  77: { icon: "snow-1",        en: "Snow grains",        bg: "Снежни зърна" },
  80: { icon: "showers-day-1", night: "showers-night-1", en: "Light showers", bg: "Слаби превалявания" },
  81: { icon: "showers-day-3", night: "showers-night-3", en: "Showers", bg: "Превалявания" },
  // A downpour, so no sun; and no thunder either, which is the storm codes' to draw.
  82: { icon: "rain-5",        en: "Heavy showers",      bg: "Силни превалявания" },
  85: { icon: "snow-showers-day", night: "snow-showers-night", en: "Snow showers", bg: "Снежни превалявания" },
  86: { icon: "snow-5",        en: "Heavy snow showers", bg: "Силни снежни превалявания" },
  95: { icon: "thunderstorms", en: "Thunderstorm",       bg: "Гръмотевична буря" },
  96: { icon: "thunderstorms-hail", en: "Thunderstorm, hail", bg: "Буря с градушка" },
  99: { icon: "thunderstorms-extreme-hail", en: "Severe storm, hail", bg: "Силна буря с градушка" }
};

// `icon` is the image's address.
export function weatherFor(code, lang, isDay = true) {
  const entry = CODES[code];
  if (!entry) return { icon: iconUrl("not-available"), label: null };
  return { icon: iconUrl(!isDay && entry.night ? entry.night : entry.icon), label: entry[lang] };
}

// Maps a code to a background theme group.
export function groupFor(code) {
  if (code <= 1) return "clear";
  if (code <= 3) return "clouds";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "rain";
}
