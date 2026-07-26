// WMO weather codes → icons plus a label per language. `night` is optional and
// only differs for clear/partly-cloudy conditions.
export const CODES = {
  0:  { icon: "☀️",  night: "🌙", en: "Clear skies",        bg: "Ясно" },
  1:  { icon: "🌤️", night: "🌙", en: "Mostly clear",       bg: "Предимно ясно" },
  2:  { icon: "⛅",  night: "☁️", en: "Partly cloudy",      bg: "Частична облачност" },
  3:  { icon: "☁️",              en: "Overcast",           bg: "Плътна облачност" },
  45: { icon: "🌫️",             en: "Fog",                bg: "Мъгла" },
  48: { icon: "🌫️",             en: "Rime fog",           bg: "Ледена мъгла" },
  51: { icon: "🌦️",             en: "Light drizzle",      bg: "Слаб дъждец" },
  53: { icon: "🌦️",             en: "Drizzle",            bg: "Дъждец" },
  55: { icon: "🌧️",             en: "Heavy drizzle",      bg: "Силен дъждец" },
  56: { icon: "🌧️",             en: "Freezing drizzle",   bg: "Заледяващ дъждец" },
  57: { icon: "🌧️",             en: "Freezing drizzle",   bg: "Заледяващ дъждец" },
  61: { icon: "🌦️",             en: "Light rain",         bg: "Слаб дъжд" },
  63: { icon: "🌧️",             en: "Rain",               bg: "Дъжд" },
  65: { icon: "🌧️",             en: "Heavy rain",         bg: "Силен дъжд" },
  66: { icon: "🌧️",             en: "Freezing rain",      bg: "Заледяващ дъжд" },
  67: { icon: "🌧️",             en: "Freezing rain",      bg: "Заледяващ дъжд" },
  71: { icon: "🌨️",             en: "Light snow",         bg: "Слаб снеговалеж" },
  73: { icon: "❄️",             en: "Snow",               bg: "Снеговалеж" },
  75: { icon: "❄️",             en: "Heavy snow",         bg: "Силен снеговалеж" },
  77: { icon: "🌨️",             en: "Snow grains",        bg: "Снежни зърна" },
  80: { icon: "🌦️",             en: "Light showers",      bg: "Слаби превалявания" },
  81: { icon: "🌧️",             en: "Showers",            bg: "Превалявания" },
  82: { icon: "⛈️",             en: "Heavy showers",      bg: "Силни превалявания" },
  85: { icon: "🌨️",             en: "Snow showers",       bg: "Снежни превалявания" },
  86: { icon: "❄️",             en: "Heavy snow showers", bg: "Силни снежни превалявания" },
  95: { icon: "⛈️",             en: "Thunderstorm",       bg: "Гръмотевична буря" },
  96: { icon: "⛈️",             en: "Thunderstorm, hail", bg: "Буря с градушка" },
  99: { icon: "⛈️",             en: "Severe storm, hail", bg: "Силна буря с градушка" }
};

export function weatherFor(code, lang, isDay = true) {
  const entry = CODES[code];
  if (!entry) return { icon: "❓", label: null };
  return { icon: !isDay && entry.night ? entry.night : entry.icon, label: entry[lang] };
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
