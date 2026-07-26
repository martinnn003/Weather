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
    feelsLike: "Feels like",
    humidity: "Humidity",
    wind: "Wind",
    uv: "UV index",
    precip: "Precip.",
    sunrise: "Sunrise",
    sunset: "Sunset",
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
    feelsLike: "Усеща се като",
    humidity: "Влажност",
    wind: "Вятър",
    uv: "UV индекс",
    precip: "Валежи",
    sunrise: "Изгрев",
    sunset: "Залез",
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

let lang = localStorage.getItem("lang");
if (!I18N[lang]) lang = navigator.language?.toLowerCase().startsWith("bg") ? "bg" : "en";
const L = () => I18N[lang];

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
  if (!entry) return ["❓", L().unknown];
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

const weatherUrl = (lat, lon) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
  "&current=temperature_2m,weather_code,relative_humidity_2m,apparent_temperature,wind_speed_10m,precipitation,is_day" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max" +
  "&hourly=temperature_2m,weather_code,precipitation_probability,is_day" +
  "&timezone=auto&forecast_days=10";

// Open-Meteo localises city and country names via `language`.
const geocodeUrl = query =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=${lang}`;

const forecastEl = document.getElementById("forecast");
const hourlyEl = document.getElementById("hourly");
const cityEl = document.getElementById("city");
const tempEl = document.getElementById("temp");
const condEl = document.getElementById("cond");
const detailsEl = document.getElementById("details");
const subtitleEl = document.getElementById("subtitle");
const nowEl = document.getElementById("now");
const loaderEl = document.getElementById("loader");
const errorEl = document.getElementById("error");
const footerEl = document.getElementById("footer");
const brandEl = document.getElementById("brand");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const geoBtn = document.getElementById("geo-btn");
const unitToggleEl = document.getElementById("unit-toggle");
const langToggleEl = document.getElementById("lang-toggle");
const unitCBtn = document.getElementById("unit-c");
const unitFBtn = document.getElementById("unit-f");
const langBgBtn = document.getElementById("lang-bg");
const langEnBtn = document.getElementById("lang-en");

// `labelKey` is set for the two built-in labels (own location, default city) so
// they follow the interface language; searched cities keep the geocoded name.
const state = { data: null, coords: null, label: "", labelKey: null };
let unit = localStorage.getItem("unit") === "f" ? "f" : "c";
let selectedDay = null;

// ---- Unit helpers (data is stored in °C / km-h and converted on display) ----
const conv = c => (unit === "f" ? c * 9 / 5 + 32 : c);
const tempStr = c => `${Math.round(conv(c))}°`;
const windStr = kmh => (unit === "f" ? `${Math.round(kmh / 1.609)} mph` : `${Math.round(kmh)} km/h`);
const timeStr = iso => iso.slice(11, 16);

// ---- Rendering ----
function detailTiles(current, daily) {
  const tiles = [
    ["🌡️", L().feelsLike, tempStr(current.apparent_temperature)],
    ["💧", L().humidity,  `${current.relative_humidity_2m}%`],
    ["💨", L().wind,      windStr(current.wind_speed_10m)],
    ["😎", L().uv,        Math.round(daily.uv_index_max[0] ?? 0)],
    ["🌧️", L().precip,    `${daily.precipitation_probability_max[0] ?? 0}%`],
    ["🌅", L().sunrise,   timeStr(daily.sunrise[0])],
    ["🌇", L().sunset,    timeStr(daily.sunset[0])]
  ];
  return tiles.map(([icon, label, value]) => `
    <div class="detail">
      <div class="di">${icon}</div>
      <div class="dv">${value}</div>
      <div class="dl">${label}</div>
    </div>`).join("");
}

function renderHours(dayIndex) {
  const { hourly, daily } = state.data;
  const date = daily.time[dayIndex];
  hourlyEl.innerHTML = hourly.time.map((t, i) => {
    if (!t.startsWith(date)) return "";
    const [icon] = weatherFor(hourly.weather_code[i], hourly.is_day[i] === 1);
    return `
      <div class="hour">
        <div class="h">${t.slice(11, 16)}</div>
        <div class="icon">${icon}</div>
        <div class="t">${tempStr(hourly.temperature_2m[i])}</div>
        <div class="p">💧${hourly.precipitation_probability[i]}%</div>
      </div>`;
  }).join("");
  hourlyEl.hidden = false;
}

function markSelected() {
  document.querySelectorAll(".day").forEach((el, i) =>
    el.classList.toggle("selected", i === selectedDay));
}

function render() {
  const { current, daily } = state.data;
  const isDay = current.is_day === 1;

  cityEl.textContent = state.label;
  document.body.className = `weather-${groupFor(current.weather_code)}${isDay ? "" : " night"}`;

  const [icon, cond] = weatherFor(current.weather_code, isDay);
  tempEl.textContent = `${tempStr(current.temperature_2m)}${unit === "f" ? "F" : "C"}`;
  condEl.textContent = `${icon} ${cond}`;
  detailsEl.innerHTML = detailTiles(current, daily);

  forecastEl.innerHTML = daily.time.map((date, i) => {
    const name = new Date(date).toLocaleDateString(L().locale, { weekday: "short" });
    const [dayIcon, dayCond] = weatherFor(daily.weather_code[i]);
    const hi = tempStr(daily.temperature_2m_max[i]);
    const lo = tempStr(daily.temperature_2m_min[i]);
    return `
      <div class="day" data-index="${i}" role="button" tabindex="0"
        aria-label="${L().dayAria(name, dayCond, hi, lo)}">
        <div class="name">${name}</div>
        <div class="icon">${dayIcon}</div>
        <div class="hi">${hi}</div>
        <div class="lo">${lo}</div>
      </div>`;
  }).join("");

  nowEl.hidden = false;
  if (selectedDay !== null) renderHours(selectedDay);
  markSelected();
}

function toggleHours(dayIndex) {
  if (dayIndex === selectedDay) {
    selectedDay = null;
    hourlyEl.hidden = true;
  } else {
    selectedDay = dayIndex;
    renderHours(dayIndex);
  }
  markSelected();
}

async function loadWeather(lat, lon, label, labelKey = null) {
  selectedDay = null;
  hourlyEl.hidden = true;
  errorEl.hidden = true;
  nowEl.hidden = true;
  forecastEl.innerHTML = "";
  loaderEl.hidden = false;
  try {
    const res = await fetch(weatherUrl(lat, lon));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.data = await res.json();
    state.coords = { lat, lon };
    state.label = label;
    state.labelKey = labelKey;
    localStorage.setItem("lastCity", JSON.stringify({ lat, lon, label, labelKey }));
    render();
  } catch (err) {
    errorEl.textContent = L().loadError;
    errorEl.hidden = false;
    console.error(err);
  } finally {
    loaderEl.hidden = true;
  }
}

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
        searchResults.innerHTML = `<li class="no-results" role="option">${L().noResults}</li>`;
      } else {
        searchResults.innerHTML = results.map(r => {
          const region = [r.admin1, r.country].filter(Boolean).join(", ");
          return `<li role="option" data-lat="${r.latitude}" data-lon="${r.longitude}"
            data-label="${r.name}, ${r.country}">${r.name}<span>${region}</span></li>`;
        }).join("");
      }
      searchResults.hidden = false;
      searchInput.setAttribute("aria-expanded", "true");
    } catch (err) {
      searchResults.innerHTML = `<li class="no-results" role="option">${L().searchFailed}</li>`;
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
  loadWeather(item.dataset.lat, item.dataset.lon, item.dataset.label);
});

document.addEventListener("click", e => {
  if (!e.target.closest(".search")) hideResults();
});

// ---- Geolocation ----
geoBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    errorEl.textContent = L().geoUnsupported;
    errorEl.hidden = false;
    return;
  }
  geoBtn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    pos => {
      geoBtn.disabled = false;
      loadWeather(pos.coords.latitude.toFixed(2), pos.coords.longitude.toFixed(2),
        L().myLocation, "myLocation");
    },
    err => {
      geoBtn.disabled = false;
      errorEl.textContent = L().geoFailed;
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
  if (state.data) render();
}
unitCBtn.addEventListener("click", () => setUnit("c"));
unitFBtn.addEventListener("click", () => setUnit("f"));

// ---- Language toggle ----
function applyLang() {
  const d = L();
  document.documentElement.lang = lang;
  document.title = d.title;
  brandEl.textContent = d.brand;
  subtitleEl.textContent = d.subtitle;
  footerEl.innerHTML = d.footer;

  searchInput.placeholder = d.searchPlaceholder;
  searchInput.setAttribute("aria-label", d.searchLabel);
  searchResults.setAttribute("aria-label", d.resultsLabel);
  geoBtn.title = d.geoLabel;
  geoBtn.setAttribute("aria-label", d.geoLabel);
  unitToggleEl.setAttribute("aria-label", d.unitLabel);
  langToggleEl.setAttribute("aria-label", d.langLabel);
  loaderEl.setAttribute("aria-label", d.loadingLabel);
  forecastEl.setAttribute("aria-label", d.forecastLabel);
  hourlyEl.setAttribute("aria-label", d.hourlyLabel);

  langBgBtn.classList.toggle("active", lang === "bg");
  langEnBtn.classList.toggle("active", lang === "en");
  langBgBtn.setAttribute("aria-pressed", lang === "bg");
  langEnBtn.setAttribute("aria-pressed", lang === "en");

  if (state.data) {
    // Built-in labels follow the language; geocoded city names stay as fetched.
    if (state.labelKey) state.label = d[state.labelKey];
    render();
  } else {
    cityEl.textContent = d.loading;
  }
}

function setLang(l) {
  if (!I18N[l] || l === lang) return;
  lang = l;
  localStorage.setItem("lang", l);
  applyLang();
}
langBgBtn.addEventListener("click", () => setLang("bg"));
langEnBtn.addEventListener("click", () => setLang("en"));

// ---- Startup ----
setUnit(unit);
applyLang();
const savedCity = JSON.parse(localStorage.getItem("lastCity") || "null");
if (savedCity) {
  const label = savedCity.labelKey ? L()[savedCity.labelKey] : savedCity.label;
  loadWeather(savedCity.lat, savedCity.lon, label, savedCity.labelKey ?? null);
} else {
  loadWeather(42.69, 27.71, L().defaultCity, "defaultCity");
}

// ---- Progressive Web App: register the service worker ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("service-worker.js").catch(console.error));
}
