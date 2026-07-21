// WMO weather codes → [label, day icon, night icon?]. Night icon is optional and
// only differs for clear/partly-cloudy conditions.
const CODES = {
  0:  ["Clear skies",        "☀️", "🌙"],
  1:  ["Mostly clear",       "🌤️", "🌙"],
  2:  ["Partly cloudy",      "⛅", "☁️"],
  3:  ["Overcast",           "☁️"],
  45: ["Fog",                "🌫️"],
  48: ["Rime fog",           "🌫️"],
  51: ["Light drizzle",      "🌦️"],
  53: ["Drizzle",            "🌦️"],
  55: ["Heavy drizzle",      "🌧️"],
  56: ["Freezing drizzle",   "🌧️"],
  57: ["Freezing drizzle",   "🌧️"],
  61: ["Light rain",         "🌦️"],
  63: ["Rain",               "🌧️"],
  65: ["Heavy rain",         "🌧️"],
  66: ["Freezing rain",      "🌧️"],
  67: ["Freezing rain",      "🌧️"],
  71: ["Light snow",         "🌨️"],
  73: ["Snow",               "❄️"],
  75: ["Heavy snow",         "❄️"],
  77: ["Snow grains",        "🌨️"],
  80: ["Light showers",      "🌦️"],
  81: ["Showers",            "🌧️"],
  82: ["Heavy showers",      "⛈️"],
  85: ["Snow showers",       "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm",       "⛈️"],
  96: ["Thunderstorm, hail", "⛈️"],
  99: ["Severe storm, hail", "⛈️"]
};

const weatherFor = (code, isDay = true) => {
  const entry = CODES[code] ?? ["Unknown", "❓"];
  const icon = !isDay && entry[2] ? entry[2] : entry[1];
  return [icon, entry[0]];
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

const geocodeUrl = query =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en`;

const forecastEl = document.getElementById("forecast");
const hourlyEl = document.getElementById("hourly");
const cityEl = document.getElementById("city");
const tempEl = document.getElementById("temp");
const condEl = document.getElementById("cond");
const detailsEl = document.getElementById("details");
const nowEl = document.getElementById("now");
const loaderEl = document.getElementById("loader");
const errorEl = document.getElementById("error");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const geoBtn = document.getElementById("geo-btn");
const unitCBtn = document.getElementById("unit-c");
const unitFBtn = document.getElementById("unit-f");

const state = { data: null, coords: null, label: "" };
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
    ["🌡️", "Feels like", tempStr(current.apparent_temperature)],
    ["💧", "Humidity",   `${current.relative_humidity_2m}%`],
    ["💨", "Wind",       windStr(current.wind_speed_10m)],
    ["😎", "UV index",   Math.round(daily.uv_index_max[0] ?? 0)],
    ["🌧️", "Precip.",    `${daily.precipitation_probability_max[0] ?? 0}%`],
    ["🌅", "Sunrise",    timeStr(daily.sunrise[0])],
    ["🌇", "Sunset",     timeStr(daily.sunset[0])]
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
    const name = new Date(date).toLocaleDateString("en-US", { weekday: "short" });
    const [dayIcon, dayCond] = weatherFor(daily.weather_code[i]);
    return `
      <div class="day" data-index="${i}" role="button" tabindex="0"
        aria-label="${name}: ${dayCond}, high ${tempStr(daily.temperature_2m_max[i])}, low ${tempStr(daily.temperature_2m_min[i])}">
        <div class="name">${name}</div>
        <div class="icon">${dayIcon}</div>
        <div class="hi">${tempStr(daily.temperature_2m_max[i])}</div>
        <div class="lo">${tempStr(daily.temperature_2m_min[i])}</div>
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

async function loadWeather(lat, lon, label) {
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
    localStorage.setItem("lastCity", JSON.stringify({ lat, lon, label }));
    render();
  } catch (err) {
    errorEl.textContent = "Could not load weather data. Please try again later.";
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
        searchResults.innerHTML = `<li class="no-results" role="option">No cities found</li>`;
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
      searchResults.innerHTML = `<li class="no-results" role="option">Search failed. Try again.</li>`;
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
    errorEl.textContent = "Geolocation is not supported by your browser.";
    errorEl.hidden = false;
    return;
  }
  geoBtn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    pos => {
      geoBtn.disabled = false;
      loadWeather(pos.coords.latitude.toFixed(2), pos.coords.longitude.toFixed(2), "My Location");
    },
    err => {
      geoBtn.disabled = false;
      errorEl.textContent = "Could not get your location. Please allow location access.";
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

// ---- Startup ----
setUnit(unit);
const savedCity = JSON.parse(localStorage.getItem("lastCity") || "null");
if (savedCity) loadWeather(savedCity.lat, savedCity.lon, savedCity.label);
else loadWeather(42.69, 27.71, "Sunny Beach, Bulgaria");

// ---- Progressive Web App: register the service worker ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("service-worker.js").catch(console.error));
}
