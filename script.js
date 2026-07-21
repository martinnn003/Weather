const WEATHER = [
  [0, "☀️", "Clear skies"],
  [1, "🌤️", "Mostly clear"],
  [2, "⛅", "Partly cloudy"],
  [3, "☁️", "Overcast"],
  [48, "🌫️", "Fog"],
  [57, "🌦️", "Drizzle"],
  [67, "🌧️", "Rain"],
  [77, "🌨️", "Snow"],
  [82, "🌦️", "Rain showers"],
  [86, "🌨️", "Snow showers"],
  [99, "⛈️", "Thunderstorm"]
];

const weatherFor = code =>
  (WEATHER.find(([max]) => code <= max) ?? [0, "❓", "Unknown"]).slice(-2);

const weatherUrl = (lat, lon) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
  "&hourly=temperature_2m,weather_code,precipitation_probability" +
  "&current=temperature_2m,weather_code&timezone=auto&forecast_days=10";

const geocodeUrl = query =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en`;

const forecastEl = document.getElementById("forecast");
const hourlyEl = document.getElementById("hourly");
const cityEl = document.getElementById("city");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
let hourly = null;
let selectedDay = null;

function toggleHours(dayIndex, date) {
  if (dayIndex === selectedDay) {
    selectedDay = null;
    hourlyEl.hidden = true;
  } else {
    selectedDay = dayIndex;
    hourlyEl.innerHTML = hourly.time.map((t, i) => {
      if (!t.startsWith(date)) return "";
      const [icon] = weatherFor(hourly.weather_code[i]);
      return `
        <div class="hour">
          <div class="h">${t.slice(11)}</div>
          <div class="icon">${icon}</div>
          <div class="t">${Math.round(hourly.temperature_2m[i])}°</div>
          <div class="p">💧${hourly.precipitation_probability[i]}%</div>
        </div>`;
    }).join("");
    hourlyEl.hidden = false;
  }
  document.querySelectorAll(".day").forEach((el, i) =>
    el.classList.toggle("selected", i === selectedDay));
}

async function loadWeather(lat, lon, label) {
  selectedDay = null;
  hourlyEl.hidden = true;
  try {
    const res = await fetch(weatherUrl(lat, lon));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { current, daily, hourly: hourlyData } = await res.json();
    hourly = hourlyData;
    cityEl.textContent = `☀️ ${label}`;

    const [icon, cond] = weatherFor(current.weather_code);
    document.querySelector(".now .temp").textContent = `${Math.round(current.temperature_2m)}°C`;
    document.querySelector(".now .cond").textContent = `${icon} ${cond}`;

    forecastEl.innerHTML = daily.time.map((date, i) => {
      const name = new Date(date).toLocaleDateString("en-US", { weekday: "short" });
      const [dayIcon] = weatherFor(daily.weather_code[i]);
      return `
        <div class="day" data-index="${i}" data-date="${date}">
          <div class="name">${name}</div>
          <div class="icon">${dayIcon}</div>
          <div class="hi">${Math.round(daily.temperature_2m_max[i])}°</div>
          <div class="lo">${Math.round(daily.temperature_2m_min[i])}°</div>
        </div>`;
    }).join("");
  } catch (err) {
    forecastEl.innerHTML = `<p class="error">Could not load weather data. Please try again later.</p>`;
    console.error(err);
  }
}

forecastEl.addEventListener("click", e => {
  const day = e.target.closest(".day");
  if (day) toggleHours(Number(day.dataset.index), day.dataset.date);
});

let searchTimer = null;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const query = searchInput.value.trim();
  if (query.length < 2) {
    searchResults.hidden = true;
    return;
  }
  searchTimer = setTimeout(async () => {
    try {
      const res = await fetch(geocodeUrl(query));
      const { results } = await res.json();
      if (!results?.length) {
        searchResults.innerHTML = `<li class="no-results">No cities found</li>`;
      } else {
        searchResults.innerHTML = results.map(r => {
          const region = [r.admin1, r.country].filter(Boolean).join(", ");
          return `<li data-lat="${r.latitude}" data-lon="${r.longitude}"
            data-label="${r.name}, ${r.country}">${r.name}<span>${region}</span></li>`;
        }).join("");
      }
      searchResults.hidden = false;
    } catch (err) {
      console.error(err);
    }
  }, 300);
});

searchResults.addEventListener("click", e => {
  const item = e.target.closest("li[data-lat]");
  if (!item) return;
  searchResults.hidden = true;
  searchInput.value = "";
  loadWeather(item.dataset.lat, item.dataset.lon, item.dataset.label);
});

document.addEventListener("click", e => {
  if (!e.target.closest(".search")) searchResults.hidden = true;
});

loadWeather(42.69, 27.71, "Sunny Beach, Bulgaria");
