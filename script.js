// ---- Interface translations (en / bg) ------------------------------------
const I18N = {
  en: {
    locale: "en-US",
    title: "Weather — 10-Day Forecast",
    brand: "☀️ Weather",
    searchPlaceholder: "Search for a city…",
    searchLabel: "Search for a city",
    resultsLabel: "City search results",
    geoLabel: "Use my location",
    unitLabel: "Temperature unit",
    langLabel: "Language",
    loadingLabel: "Loading weather",
    loading: "Loading…",
    subtitle: "10-Day Weather Forecast",
    forecastLabel: "10-day forecast",
    hourlyLabel: "Hourly forecast",
    today: "Today",
    tomorrow: "Tomorrow",
    feelsLike: "Feels like",
    humidity: "Humidity",
    wind: "Wind",
    pressure: "Pressure",
    visibility: "Visibility",
    air: "Air",
    uv: "UV index",
    precip: "Precip.",
    precipTotal: "Rainfall",
    high: "High",
    low: "Low",
    sunrise: "Sunrise",
    sunset: "Sunset",
    compass: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
    aqi: ["Good", "Fair", "Moderate", "Poor", "Very poor", "Extremely poor"],
    favLabel: "Saved cities",
    favAdd: "Save this city",
    favRemove: "Remove from saved",
    favRemoveOne: name => `Remove ${name}`,
    radarLabel: "Precipitation radar",
    radarFailed: "The radar could not be loaded.",
    radarTime: time => `Radar · ${time}`,
    shareLabel: "Copy link",
    shareCopied: "Link copied ✓",
    shareFailed: "Could not copy the link.",
    noResults: "No cities found",
    searchFailed: "Search failed. Try again.",
    loadError: "Could not load weather data. Please try again later.",
    geoUnsupported: "Geolocation is not supported by your browser.",
    geoFailed: "Could not get your location. Please allow location access.",
    footer: 'Live data from <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>',
    myLocation: "My Location",
    defaultCity: "Sunny Beach, Bulgaria",
    unknown: "Unknown",
    dayAria: (name, cond, hi, lo) => `${name}: ${cond}, high ${hi}, low ${lo}`
  },
  bg: {
    locale: "bg-BG",
    title: "Времето — прогноза за 10 дни",
    brand: "☀️ Времето",
    searchPlaceholder: "Търси град…",
    searchLabel: "Търсене на град",
    resultsLabel: "Резултати от търсенето",
    geoLabel: "Моето местоположение",
    unitLabel: "Мерна единица за температура",
    langLabel: "Език",
    loadingLabel: "Зареждане на прогнозата",
    loading: "Зареждане…",
    subtitle: "Прогноза за времето за 10 дни",
    forecastLabel: "Прогноза за 10 дни",
    hourlyLabel: "Почасова прогноза",
    today: "Днес",
    tomorrow: "Утре",
    feelsLike: "Усеща се като",
    humidity: "Влажност",
    wind: "Вятър",
    pressure: "Налягане",
    visibility: "Видимост",
    air: "Въздух",
    uv: "UV индекс",
    precip: "Валежи",
    precipTotal: "Количество",
    high: "Макс.",
    low: "Мин.",
    sunrise: "Изгрев",
    sunset: "Залез",
    compass: ["С", "СИ", "И", "ЮИ", "Ю", "ЮЗ", "З", "СЗ"],
    aqi: ["Добро", "Задоволително", "Умерено", "Лошо", "Много лошо", "Изключително лошо"],
    favLabel: "Запазени градове",
    favAdd: "Запази този град",
    favRemove: "Премахни от запазените",
    favRemoveOne: name => `Премахни ${name}`,
    radarLabel: "Радар за валежи",
    radarFailed: "Радарът не можа да се зареди.",
    radarTime: time => `Радар · ${time}`,
    shareLabel: "Копирай линка",
    shareCopied: "Линкът е копиран ✓",
    shareFailed: "Линкът не можа да се копира.",
    noResults: "Няма намерени градове",
    searchFailed: "Търсенето се провали. Опитай отново.",
    loadError: "Данните за времето не можаха да се заредят. Опитай отново по-късно.",
    geoUnsupported: "Браузърът ти не поддържа геолокация.",
    geoFailed: "Местоположението не можа да бъде определено. Разреши достъпа до локация.",
    footer: 'Данни в реално време от <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>',
    myLocation: "Моето местоположение",
    defaultCity: "Слънчев бряг, България",
    unknown: "Неизвестно",
    dayAria: (name, cond, hi, lo) => `${name}: ${cond}, макс. ${hi}, мин. ${lo}`
  }
};

// A shared link may carry the language and unit, so read those before anything else.
const params = new URLSearchParams(location.search);
let lang = params.get("lang") || localStorage.getItem("lang");
if (!I18N[lang]) lang = navigator.language?.toLowerCase().startsWith("bg") ? "bg" : "en";
const t = () => I18N[lang];

// WMO weather codes → icons plus a label per language. `night` is optional and
// only differs for clear/partly-cloudy conditions.
const CODES = {
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

const weatherFor = (code, isDay = true) => {
  const entry = CODES[code];
  if (!entry) return ["❓", t().unknown];
  return [!isDay && entry.night ? entry.night : entry.icon, entry[lang]];
};

// Maps a code to a background theme group.
const groupFor = code => {
  if (code <= 1) return "clear";
  if (code <= 3) return "clouds";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "rain";
};

// ---- Endpoints ------------------------------------------------------------
const weatherUrl = (lat, lon) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
  "&current=temperature_2m,weather_code,relative_humidity_2m,apparent_temperature," +
  "wind_speed_10m,wind_direction_10m,surface_pressure,precipitation,is_day" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max," +
  "wind_speed_10m_max,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum" +
  "&hourly=temperature_2m,weather_code,precipitation_probability,visibility,is_day" +
  "&timezone=auto&forecast_days=10";

const airUrl = (lat, lon) =>
  "https://air-quality-api.open-meteo.com/v1/air-quality" +
  `?latitude=${lat}&longitude=${lon}&current=european_aqi&timezone=auto`;

// Open-Meteo localises city and country names via `language`.
const geocodeUrl = query =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=${lang}`;

// Looks a known place up again to get its name in the current language.
const placeUrl = id =>
  `https://geocoding-api.open-meteo.com/v1/get?id=${id}&language=${lang}`;

const RADAR_INDEX = "https://api.rainviewer.com/public/weather-maps.json";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

// ---- Elements -------------------------------------------------------------
const forecastEl = document.getElementById("forecast");
const hourlyEl = document.getElementById("hourly");
const cityEl = document.getElementById("city");
const tempEl = document.getElementById("temp");
const condEl = document.getElementById("cond");
const detailsEl = document.getElementById("details");
const subtitleEl = document.getElementById("subtitle");
const nowEl = document.getElementById("now");
const skeletonEl = document.getElementById("skeleton");
const errorEl = document.getElementById("error");
const footerEl = document.getElementById("footer");
const brandEl = document.getElementById("brand");
const toastEl = document.getElementById("toast");
const favoritesEl = document.getElementById("favorites");
const favBtn = document.getElementById("fav-btn");
const shareBtn = document.getElementById("share-btn");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const geoBtn = document.getElementById("geo-btn");
const radarBtn = document.getElementById("radar-btn");
const radarEl = document.getElementById("radar");
const radarMapEl = document.getElementById("radar-map");
const radarTimeEl = document.getElementById("radar-time");
const unitToggleEl = document.getElementById("unit-toggle");
const langToggleEl = document.getElementById("lang-toggle");
const unitCBtn = document.getElementById("unit-c");
const unitFBtn = document.getElementById("unit-f");
const langBgBtn = document.getElementById("lang-bg");
const langEnBtn = document.getElementById("lang-en");

// ---- State ----------------------------------------------------------------
// How the heading text is kept in sync with the interface language:
//   `labelKey`  — a built-in label (own location, default city), translated locally.
//   `geoId`     — a searched city; re-fetched from the geocoding API when needed.
//   `labelLang` — the language the current label was fetched in.
const state = {
  data: null, aqi: null, coords: null, nowIdx: 0, fetchedAt: 0,
  label: "", labelKey: null, geoId: null, labelLang: lang
};
let unit = params.get("unit") === "f" || (!params.get("unit") && localStorage.getItem("unit") === "f") ? "f" : "c";
let selectedDay = null;
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");

// ---- Formatting (data is stored in metric and converted on display) -------
const conv = c => (unit === "f" ? c * 9 / 5 + 32 : c);
const tempStr = c => `${Math.round(conv(c))}°`;
const windStr = kmh => (unit === "f" ? `${Math.round(kmh / 1.609)} mph` : `${Math.round(kmh)} km/h`);
const pressureStr = hPa => (unit === "f" ? `${(hPa * 0.02953).toFixed(2)} inHg` : `${Math.round(hPa)} hPa`);
const distStr = m => (unit === "f" ? `${Math.round(m / 1609)} mi` : `${Math.round(m / 1000)} km`);
const rainStr = mm => (unit === "f" ? `${(mm / 25.4).toFixed(2)} in` : `${mm.toFixed(1)} mm`);
const timeStr = iso => iso.slice(11, 16);

// Wind direction is where the wind comes FROM; the arrow shows where it blows to.
const ARROWS = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];
const windLabel = deg => {
  const i = Math.round(deg / 45) % 8;
  return `${t().wind} · ${t().compass[i]} ${ARROWS[i]}`;
};
const aqiBand = v => (v <= 20 ? 0 : v <= 40 ? 1 : v <= 60 ? 2 : v <= 80 ? 3 : v <= 100 ? 4 : 5);

const dayName = i => {
  if (i === 0) return t().today;
  if (i === 1) return t().tomorrow;
  return new Date(state.data.daily.time[i]).toLocaleDateString(t().locale, { weekday: "short" });
};

function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

// Restarts the enter animation on an element that just got new content.
function animateIn(el) {
  el.classList.remove("enter");
  void el.offsetWidth;
  el.classList.add("enter");
}

// ---- Detail tiles ---------------------------------------------------------
// Today shows live readings; a future day shows that day's aggregates.
function currentTiles() {
  const { current, daily, hourly } = state.data;
  const visibility = hourly.visibility?.[state.nowIdx];
  const tiles = [
    ["🌡️", t().feelsLike, tempStr(current.apparent_temperature)],
    ["💧", t().humidity, `${current.relative_humidity_2m}%`],
    ["💨", windLabel(current.wind_direction_10m), windStr(current.wind_speed_10m)],
    ["🧭", t().pressure, pressureStr(current.surface_pressure)]
  ];
  if (visibility != null) tiles.push(["👁️", t().visibility, distStr(visibility)]);
  tiles.push(
    ["😎", t().uv, Math.round(daily.uv_index_max[0] ?? 0)],
    ["🌧️", t().precip, `${daily.precipitation_probability_max[0] ?? 0}%`]
  );
  if (state.aqi != null) {
    tiles.push(["🍃", `${t().air} · ${t().aqi[aqiBand(state.aqi)]}`, Math.round(state.aqi)]);
  }
  tiles.push(
    ["🌅", t().sunrise, timeStr(daily.sunrise[0])],
    ["🌇", t().sunset, timeStr(daily.sunset[0])]
  );
  return tiles;
}

function dayTiles(i) {
  const { daily } = state.data;
  return [
    ["⬆️", t().high, tempStr(daily.temperature_2m_max[i])],
    ["⬇️", t().low, tempStr(daily.temperature_2m_min[i])],
    ["🌡️", t().feelsLike, tempStr(daily.apparent_temperature_max[i])],
    ["💨", t().wind, windStr(daily.wind_speed_10m_max[i])],
    ["😎", t().uv, Math.round(daily.uv_index_max[i] ?? 0)],
    ["🌧️", t().precip, `${daily.precipitation_probability_max[i] ?? 0}%`],
    ["☔", t().precipTotal, rainStr(daily.precipitation_sum[i] ?? 0)],
    ["🌅", t().sunrise, timeStr(daily.sunrise[i])],
    ["🌇", t().sunset, timeStr(daily.sunset[i])]
  ];
}

const tilesHtml = tiles => tiles.map(([icon, label, value]) => `
  <div class="detail">
    <div class="di">${icon}</div>
    <div class="dv">${value}</div>
    <div class="dl">${label}</div>
  </div>`).join("");

// ---- Hourly strip with a temperature curve --------------------------------
const HOUR_W = 62;   // must match .hour width in styles.css
const HOUR_GAP = 8;  // must match the .hours gap
const SPARK_H = 54;

// One series, no legend: every value is labelled in the cell below the curve,
// so the line stays decorative and only the daily high/low get a marker.
function sparkline(temps) {
  if (temps.length < 2) return "";
  const step = HOUR_W + HOUR_GAP;
  const width = temps.length * step - HOUR_GAP;
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const span = hi - lo || 1;
  const x = i => i * step + HOUR_W / 2;
  const y = v => SPARK_H - 10 - ((v - lo) / span) * (SPARK_H - 24);

  let line = `M ${x(0)} ${y(temps[0])}`;
  for (let i = 1; i < temps.length; i++) {
    const mid = (x(i - 1) + x(i)) / 2; // horizontal tangents keep the curve calm
    line += ` C ${mid} ${y(temps[i - 1])}, ${mid} ${y(temps[i])}, ${x(i)} ${y(temps[i])}`;
  }
  const area = `${line} L ${x(temps.length - 1)} ${SPARK_H} L ${x(0)} ${SPARK_H} Z`;
  const dot = i => `<circle class="spark-dot" cx="${x(i)}" cy="${y(temps[i])}" r="3.5"/>`;
  const iHi = temps.indexOf(hi);
  const iLo = temps.indexOf(lo);

  return `<svg class="spark" width="${width}" height="${SPARK_H}"
      viewBox="0 0 ${width} ${SPARK_H}" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.3"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#spark-fill)"/>
    <path class="spark-line" d="${line}" fill="none"/>
    ${dot(iHi)}${iLo === iHi ? "" : dot(iLo)}
  </svg>`;
}

function renderHours(dayIndex) {
  const { hourly, daily, current } = state.data;
  const date = daily.time[dayIndex];
  // For today, drop the hours that already passed.
  const from = dayIndex === 0 ? current.time.slice(0, 13) : "";
  const rows = hourly.time
    .map((time, i) => i)
    .filter(i => hourly.time[i].startsWith(date) && hourly.time[i].slice(0, 13) >= from);

  const cells = rows.map(i => {
    const [icon, cond] = weatherFor(hourly.weather_code[i], hourly.is_day[i] === 1);
    const time = timeStr(hourly.time[i]);
    const temp = tempStr(hourly.temperature_2m[i]);
    const rain = hourly.precipitation_probability[i];
    return `
      <div class="hour" title="${time} · ${cond} · ${temp} · 💧${rain}%">
        <div class="h">${time}</div>
        <div class="icon">${icon}</div>
        <div class="t">${temp}</div>
        <div class="p">💧${rain}%</div>
      </div>`;
  }).join("");

  const temps = rows.map(i => conv(hourly.temperature_2m[i]));
  hourlyEl.innerHTML = `<div class="hourly-inner">${sparkline(temps)}<div class="hours">${cells}</div></div>`;
  hourlyEl.hidden = false;
}

// ---- Rendering ------------------------------------------------------------
function markSelected() {
  document.querySelectorAll(".day").forEach((el, i) =>
    el.classList.toggle("selected", i === selectedDay));
}

function render() {
  const { current, daily } = state.data;
  const isDay = current.is_day === 1;
  const day = selectedDay ?? 0;
  const future = day > 0;

  cityEl.textContent = state.label;
  document.body.className = `weather-${groupFor(current.weather_code)}${isDay ? "" : " night"}`;

  if (future) {
    // Selecting a day turns the panel into that day's summary.
    const [icon, cond] = weatherFor(daily.weather_code[day]);
    subtitleEl.textContent = new Date(daily.time[day])
      .toLocaleDateString(t().locale, { weekday: "long", day: "numeric", month: "long" });
    tempEl.textContent = `${tempStr(daily.temperature_2m_max[day])}${unit === "f" ? "F" : "C"}`;
    condEl.textContent = `${icon} ${cond}`;
    detailsEl.innerHTML = tilesHtml(dayTiles(day));
  } else {
    const [icon, cond] = weatherFor(current.weather_code, isDay);
    subtitleEl.textContent = t().subtitle;
    tempEl.textContent = `${tempStr(current.temperature_2m)}${unit === "f" ? "F" : "C"}`;
    condEl.textContent = `${icon} ${cond}`;
    detailsEl.innerHTML = tilesHtml(currentTiles());
  }

  forecastEl.innerHTML = daily.time.map((date, i) => {
    const name = dayName(i);
    const [dayIcon, dayCond] = weatherFor(daily.weather_code[i]);
    const hi = tempStr(daily.temperature_2m_max[i]);
    const lo = tempStr(daily.temperature_2m_min[i]);
    return `
      <div class="day" data-index="${i}" role="button" tabindex="0"
        aria-label="${t().dayAria(name, dayCond, hi, lo)}">
        <div class="name">${name}</div>
        <div class="icon">${dayIcon}</div>
        <div class="hi">${hi}</div>
        <div class="lo">${lo}</div>
      </div>`;
  }).join("");

  nowEl.hidden = false;
  if (selectedDay !== null) renderHours(selectedDay);
  markSelected();
  renderFavorites();
}

function toggleHours(dayIndex) {
  const opening = dayIndex !== selectedDay;
  selectedDay = opening ? dayIndex : null;
  if (!opening) hourlyEl.hidden = true;
  render(); // renders the strip for the newly selected day
  if (opening) animateIn(hourlyEl);
}

// ---- Loading --------------------------------------------------------------
// A searched city keeps the name it was found under, so re-fetch it when the
// interface language no longer matches. Failure is harmless — the old name stays.
async function relabelCity() {
  if (!state.geoId || state.labelLang === lang) return;
  const forLang = lang;
  try {
    const res = await fetch(placeUrl(state.geoId));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const place = await res.json();
    if (forLang !== lang) return; // language changed again while fetching
    state.label = [place.name, place.country].filter(Boolean).join(", ");
    state.labelLang = forLang;
    cityEl.textContent = state.label;
    saveCity();
    renderFavorites();
  } catch (err) {
    console.error(err);
  }
}

function saveCity() {
  const { coords, label, labelKey, geoId, labelLang } = state;
  localStorage.setItem("lastCity",
    JSON.stringify({ lat: coords.lat, lon: coords.lon, label, labelKey, geoId, labelLang }));
  syncUrl();
}

// Keeps the address bar shareable: it always describes what is on screen.
function syncUrl() {
  if (!state.coords) return;
  const query = new URLSearchParams({ lat: state.coords.lat, lon: state.coords.lon, lang, unit });
  if (state.geoId) query.set("id", state.geoId);
  if (state.labelKey) query.set("key", state.labelKey);
  else if (state.label) query.set("city", state.label);
  history.replaceState(null, "", `?${query}`);
}

async function loadWeather(lat, lon, label, meta = {}) {
  const silent = meta.silent === true; // background refresh: keep the panels up
  if (!silent) {
    selectedDay = null;
    hourlyEl.hidden = true;
    nowEl.hidden = true;
    forecastEl.innerHTML = "";
    skeletonEl.hidden = false;
  }
  errorEl.hidden = true;
  try {
    // Air quality is a separate service; the forecast must not depend on it.
    const [weather, air] = await Promise.allSettled([
      fetch(weatherUrl(lat, lon)).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      }),
      fetch(airUrl(lat, lon)).then(res => (res.ok ? res.json() : null))
    ]);
    if (weather.status === "rejected") throw weather.reason;

    state.data = weather.value;
    state.aqi = air.status === "fulfilled" ? air.value?.current?.european_aqi ?? null : null;
    state.coords = { lat, lon };
    state.nowIdx = Math.max(0, state.data.hourly.time
      .findIndex(time => time.startsWith(state.data.current.time.slice(0, 13))));
    state.fetchedAt = Date.now();
    state.label = label;
    state.labelKey = meta.labelKey ?? null;
    state.geoId = meta.geoId ?? null;
    // An explicit null means "unknown", which must survive: it triggers a re-fetch.
    state.labelLang = "labelLang" in meta ? meta.labelLang : lang;
    saveCity();
    render();
    if (!silent) {
      animateIn(nowEl);
      animateIn(forecastEl);
    }
    relabelCity();
    if (!radarEl.hidden) centerRadar();
  } catch (err) {
    if (!silent) {
      errorEl.textContent = t().loadError;
      errorEl.hidden = false;
    }
    console.error(err);
  } finally {
    skeletonEl.hidden = true;
  }
}

// ---- Favourite cities -----------------------------------------------------
const cityOf = () => ({
  lat: Number(state.coords.lat), lon: Number(state.coords.lon),
  label: state.label, labelKey: state.labelKey, geoId: state.geoId, labelLang: state.labelLang
});

// Same place if the ids match, or the coordinates are within ~5 km.
const sameCity = (a, b) => {
  if (!a || !b) return false;
  if (a.geoId && b.geoId) return String(a.geoId) === String(b.geoId);
  return Math.abs(a.lat - b.lat) < 0.05 && Math.abs(a.lon - b.lon) < 0.05;
};

function saveFavorites() {
  localStorage.setItem("favorites", JSON.stringify(favorites));
}

function renderFavorites() {
  const current = state.coords ? cityOf() : null;
  const saved = current !== null && favorites.some(f => sameCity(f, current));

  favBtn.textContent = saved ? "★" : "☆";
  favBtn.disabled = !current;
  favBtn.title = saved ? t().favRemove : t().favAdd;
  favBtn.setAttribute("aria-label", favBtn.title);
  favBtn.setAttribute("aria-pressed", String(saved));

  favoritesEl.hidden = favorites.length === 0;
  favoritesEl.innerHTML = favorites.map((f, i) => `
    <span class="chip${sameCity(f, current) ? " active" : ""}">
      <button type="button" class="chip-go" data-go="${i}">${f.label}</button>
      <button type="button" class="chip-x" data-remove="${i}"
        title="${t().favRemoveOne(f.label)}" aria-label="${t().favRemoveOne(f.label)}">×</button>
    </span>`).join("");
}

favBtn.addEventListener("click", () => {
  if (!state.coords) return;
  const city = cityOf();
  favorites = favorites.some(f => sameCity(f, city))
    ? favorites.filter(f => !sameCity(f, city))
    : [...favorites, city];
  saveFavorites();
  renderFavorites();
});

favoritesEl.addEventListener("click", e => {
  const remove = e.target.closest("[data-remove]");
  if (remove) {
    favorites.splice(Number(remove.dataset.remove), 1);
    saveFavorites();
    renderFavorites();
    return;
  }
  const go = e.target.closest("[data-go]");
  if (!go) return;
  const f = favorites[Number(go.dataset.go)];
  loadWeather(f.lat, f.lon, f.labelKey ? t()[f.labelKey] : f.label,
    { labelKey: f.labelKey, geoId: f.geoId, labelLang: f.labelKey ? lang : f.labelLang });
});

// Saved names follow the language too — built-in labels locally, the rest by id.
async function relabelFavorites() {
  favorites.forEach(f => {
    if (f.labelKey) {
      f.label = t()[f.labelKey];
      f.labelLang = lang;
    }
  });
  const stale = favorites.filter(f => f.geoId && f.labelLang !== lang);
  renderFavorites();
  if (!stale.length) {
    saveFavorites();
    return;
  }
  const forLang = lang;
  await Promise.all(stale.map(async f => {
    try {
      const res = await fetch(placeUrl(f.geoId));
      if (!res.ok) return;
      const place = await res.json();
      if (forLang !== lang) return;
      f.label = [place.name, place.country].filter(Boolean).join(", ");
      f.labelLang = forLang;
    } catch (err) {
      console.error(err);
    }
  }));
  saveFavorites();
  renderFavorites();
}

// ---- Share ----------------------------------------------------------------
shareBtn.addEventListener("click", async () => {
  syncUrl();
  try {
    await navigator.clipboard.writeText(location.href);
    toast(t().shareCopied);
  } catch (err) {
    toast(t().shareFailed);
    console.error(err);
  }
});

// ---- Precipitation radar (Leaflet + RainViewer, loaded on demand) ---------
let map = null;
let radarLayer = null;
let leafletReady = null;

function loadLeaflet() {
  if (leafletReady) return leafletReady;
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = LEAFLET_CSS;
  document.head.appendChild(style);
  leafletReady = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Leaflet failed to load"));
    document.head.appendChild(script);
  });
  return leafletReady;
}

function centerRadar() {
  if (map && state.coords) map.setView([Number(state.coords.lat), Number(state.coords.lon)], 7);
}

async function addRadarFrame() {
  const res = await fetch(RADAR_INDEX);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const index = await res.json();
  const frame = index.radar?.past?.at(-1);
  if (!frame) throw new Error("No radar frame available");
  if (radarLayer) map.removeLayer(radarLayer);
  radarLayer = window.L.tileLayer(`${index.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
    { opacity: 0.65, maxZoom: 12 }).addTo(map);
  radarTimeEl.textContent = t().radarTime(
    new Date(frame.time * 1000).toLocaleTimeString(t().locale, { hour: "2-digit", minute: "2-digit" }));
}

async function openRadar() {
  radarEl.hidden = false;
  radarBtn.setAttribute("aria-pressed", "true");
  animateIn(radarEl);
  try {
    await loadLeaflet();
    if (!map) {
      map = window.L.map(radarMapEl, { attributionControl: true });
      window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 12, attribution: "© OpenStreetMap" }).addTo(map);
    }
    centerRadar();
    map.invalidateSize();
    await addRadarFrame();
  } catch (err) {
    radarEl.hidden = true;
    radarBtn.setAttribute("aria-pressed", "false");
    errorEl.textContent = t().radarFailed;
    errorEl.hidden = false;
    console.error(err);
  }
}

radarBtn.addEventListener("click", () => {
  if (radarEl.hidden) {
    openRadar();
  } else {
    radarEl.hidden = true;
    radarBtn.setAttribute("aria-pressed", "false");
  }
});

// ---- Forecast interaction (mouse + keyboard) ----
forecastEl.addEventListener("click", e => {
  const day = e.target.closest(".day");
  if (day) toggleHours(Number(day.dataset.index));
});
forecastEl.addEventListener("keydown", e => {
  const day = e.target.closest(".day");
  if (day && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    toggleHours(Number(day.dataset.index));
  }
});

// ---- City search ----
let searchTimer = null;
let activeIndex = -1;

function hideResults() {
  searchResults.hidden = true;
  searchInput.setAttribute("aria-expanded", "false");
  activeIndex = -1;
}

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const query = searchInput.value.trim();
  if (query.length < 2) {
    hideResults();
    return;
  }
  searchTimer = setTimeout(async () => {
    try {
      const res = await fetch(geocodeUrl(query));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { results } = await res.json();
      activeIndex = -1;
      if (!results?.length) {
        searchResults.innerHTML = `<li class="no-results" role="option">${t().noResults}</li>`;
      } else {
        searchResults.innerHTML = results.map(r => {
          const region = [r.admin1, r.country].filter(Boolean).join(", ");
          return `<li role="option" data-lat="${r.latitude}" data-lon="${r.longitude}" data-id="${r.id}"
            data-label="${r.name}, ${r.country}">${r.name}<span>${region}</span></li>`;
        }).join("");
      }
      searchResults.hidden = false;
      searchInput.setAttribute("aria-expanded", "true");
    } catch (err) {
      searchResults.innerHTML = `<li class="no-results" role="option">${t().searchFailed}</li>`;
      searchResults.hidden = false;
      console.error(err);
    }
  }, 300);
});

searchInput.addEventListener("keydown", e => {
  const items = [...searchResults.querySelectorAll("li[data-lat]")];
  if (e.key === "Escape") return hideResults();
  if (searchResults.hidden || !items.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex = (activeIndex + 1) % items.length;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex = (activeIndex - 1 + items.length) % items.length;
  } else if (e.key === "Enter" && activeIndex >= 0) {
    e.preventDefault();
    items[activeIndex].click();
    return;
  } else {
    return;
  }
  items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
  items[activeIndex].scrollIntoView({ block: "nearest" });
});

searchResults.addEventListener("click", e => {
  const item = e.target.closest("li[data-lat]");
  if (!item) return;
  hideResults();
  searchInput.value = "";
  loadWeather(item.dataset.lat, item.dataset.lon, item.dataset.label,
    { geoId: item.dataset.id });
});

document.addEventListener("click", e => {
  if (!e.target.closest(".search")) hideResults();
});

// ---- Geolocation ----
geoBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    errorEl.textContent = t().geoUnsupported;
    errorEl.hidden = false;
    return;
  }
  geoBtn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    pos => {
      geoBtn.disabled = false;
      loadWeather(pos.coords.latitude.toFixed(2), pos.coords.longitude.toFixed(2),
        t().myLocation, { labelKey: "myLocation" });
    },
    err => {
      geoBtn.disabled = false;
      errorEl.textContent = t().geoFailed;
      errorEl.hidden = false;
      console.error(err);
    },
    { timeout: 10000 }
  );
});

// ---- Unit toggle ----
function setUnit(u) {
  unit = u;
  localStorage.setItem("unit", u);
  unitCBtn.classList.toggle("active", u === "c");
  unitFBtn.classList.toggle("active", u === "f");
  unitCBtn.setAttribute("aria-pressed", u === "c");
  unitFBtn.setAttribute("aria-pressed", u === "f");
  if (state.data) {
    render();
    syncUrl();
  }
}
unitCBtn.addEventListener("click", () => setUnit("c"));
unitFBtn.addEventListener("click", () => setUnit("f"));

// ---- Language toggle ----
function applyLang() {
  const d = t();
  document.documentElement.lang = lang;
  document.title = d.title;
  brandEl.textContent = d.brand;
  footerEl.innerHTML = d.footer;

  searchInput.placeholder = d.searchPlaceholder;
  searchInput.setAttribute("aria-label", d.searchLabel);
  searchResults.setAttribute("aria-label", d.resultsLabel);
  geoBtn.title = d.geoLabel;
  geoBtn.setAttribute("aria-label", d.geoLabel);
  radarBtn.title = d.radarLabel;
  radarBtn.setAttribute("aria-label", d.radarLabel);
  radarEl.setAttribute("aria-label", d.radarLabel);
  shareBtn.title = d.shareLabel;
  shareBtn.setAttribute("aria-label", d.shareLabel);
  unitToggleEl.setAttribute("aria-label", d.unitLabel);
  langToggleEl.setAttribute("aria-label", d.langLabel);
  skeletonEl.setAttribute("aria-label", d.loadingLabel);
  forecastEl.setAttribute("aria-label", d.forecastLabel);
  hourlyEl.setAttribute("aria-label", d.hourlyLabel);
  favoritesEl.setAttribute("aria-label", d.favLabel);

  langBgBtn.classList.toggle("active", lang === "bg");
  langEnBtn.classList.toggle("active", lang === "en");
  langBgBtn.setAttribute("aria-pressed", lang === "bg");
  langEnBtn.setAttribute("aria-pressed", lang === "en");

  if (state.data) {
    if (state.labelKey) {
      state.label = d[state.labelKey];
      state.labelLang = lang;
      saveCity();
    }
    render();
    relabelCity(); // searched cities need a round trip to the geocoding API
    if (radarLayer) addRadarFrame().catch(console.error); // re-label the radar time
  } else {
    cityEl.textContent = d.loading;
    subtitleEl.textContent = d.subtitle;
  }
  relabelFavorites();
}

function setLang(l) {
  if (!I18N[l] || l === lang) return;
  lang = l;
  localStorage.setItem("lang", l);
  applyLang();
  syncUrl();
}
langBgBtn.addEventListener("click", () => setLang("bg"));
langEnBtn.addEventListener("click", () => setLang("en"));

// ---- Refresh data that went stale while the tab was in the background ----
const MAX_AGE = 30 * 60 * 1000;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !state.data) return;
  if (Date.now() - state.fetchedAt < MAX_AGE) return;
  loadWeather(state.coords.lat, state.coords.lon, state.label, {
    labelKey: state.labelKey, geoId: state.geoId, labelLang: state.labelLang, silent: true
  });
});

// ---- Startup ----
setUnit(unit);
applyLang();

// A link's coordinates win over the last visited city.
const savedCity = JSON.parse(localStorage.getItem("lastCity") || "null");
const linked = params.get("lat") && params.get("lon")
  ? {
      lat: params.get("lat"), lon: params.get("lon"),
      labelKey: params.get("key"), geoId: params.get("id"),
      label: params.get("city") || `${params.get("lat")}, ${params.get("lon")}`
    }
  : null;

if (linked) {
  loadWeather(linked.lat, linked.lon, linked.labelKey ? t()[linked.labelKey] ?? linked.label : linked.label,
    {
      labelKey: linked.labelKey,
      geoId: linked.geoId,
      // The name in a link may be in either language, so let it be re-fetched.
      labelLang: linked.labelKey ? lang : null
    });
} else if (savedCity) {
  loadWeather(savedCity.lat, savedCity.lon,
    savedCity.labelKey ? t()[savedCity.labelKey] : savedCity.label, {
      labelKey: savedCity.labelKey,
      geoId: savedCity.geoId,
      // A built-in label was just translated above; for a searched city fall back to
      // the current language, so saves predating this field keep their name.
      labelLang: savedCity.labelKey ? lang : savedCity.labelLang ?? lang
    });
} else {
  loadWeather(42.69, 27.71, t().defaultCity, { labelKey: "defaultCity" });
}

// ---- Progressive Web App: register the service worker ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("service-worker.js").catch(console.error));
}
