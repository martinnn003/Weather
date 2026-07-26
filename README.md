# ☀️ Weather

A weather app built with React, Vite and Tailwind: current conditions, a 10-day
forecast, an hourly breakdown and a precipitation radar for any city in the world.
No API key, no account.

Live data comes from [Open-Meteo](https://open-meteo.com/) (free, no registration).
Leaflet powers the radar and is code-split into its own chunk, so it only downloads
when the radar is opened.

## Features

- **Bilingual — Bulgarian and English** — the БГ/EN toggle switches the whole
  interface: labels, weather descriptions, weekday names, errors and city search
  results (Open-Meteo returns localised place names). The language defaults to the
  browser's and is remembered.
- **Current conditions** — temperature, feels-like, humidity, wind with direction,
  pressure, visibility, UV index, precipitation chance, air quality (European AQI),
  sunrise and sunset.
- **10-day forecast** — click (or press Enter/Space on) any day to expand its hourly
  breakdown; click again to collapse. Selecting a future day turns the panel into
  that day's summary — high, low, feels-like, max wind, UV, rainfall, sunrise, sunset.
  Today's hourly strip starts at the current hour, not at midnight.
- **Temperature curve** — an SVG line over the hourly strip, with markers on the
  day's high and low. Every value is also labelled in the cell below it.
- **Precipitation radar** — the 🛰️ button opens a RainViewer radar layer on an
  OpenStreetMap base (Leaflet is loaded lazily, only on first use).
- **Saved cities** — the ☆ button pins the current city to a chip bar for one-click
  switching; saved names follow the interface language too.
- **Shareable links** — the address bar always holds a link that reproduces what you
  see (city, coordinates, language, units); 🔗 copies it.
- **Stays fresh** — data older than 30 minutes is refreshed silently when you return
  to the tab.
- **City search** — type at least 2 characters to search the Open-Meteo geocoding
  API. Results are debounced by 300 ms and navigable with ↑/↓/Enter/Escape.
- **Geolocation** — the 📍 button loads the forecast for your current position.
- **°C / °F toggle** — data is fetched in metric and converted on display; wind
  switches between km/h and mph. The choice is remembered.
- **Dynamic background** — the gradient follows the weather (clear, clouds, rain,
  fog, snow, storm) and switches to a dark palette at night.
- **Remembers your last city** — stored in `localStorage`, restored on next visit.
  First-ever visit defaults to Sunny Beach, Bulgaria.
- **Installable PWA, works offline** — the app shell is cached by a service worker;
  API responses are network-first with a cached fallback.
- **Responsive** — single column on mobile, two-column dashboard on wide screens.
- **Accessible** — ARIA combobox/listbox for search, keyboard-operable forecast
  cards, `role="alert"` errors and labelled controls.

## Running it

```bash
npm install
npm run dev      # development server on http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the built bundle
npm test         # unit and component tests
```

The build is a static bundle, so `dist/` can be dropped on Vercel, Netlify, GitHub
Pages, Cloudflare Pages or any other static host. `vercel.json` already pins the
build command and output directory.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html` | Vite entry document: meta tags, manifest link, mount point |
| `src/main.jsx` | Mounts React, registers the service worker |
| `src/App.jsx` | Composes the page and owns the current place, day and radar state |
| `src/settings.jsx` | Language and unit context, with the formatters bound to them |
| `src/i18n.js` | Every interface string, one block per language |
| `src/weatherCodes.js` | WMO codes → icons, labels and background groups |
| `src/api.js` | Every network call in one place |
| `src/format.js` | Metric → display conversions (°C/°F, km/h, hPa, km, mm) |
| `src/hours.js` | Hourly filtering and the curve's geometry (pure, unit-tested) |
| `src/place.js` | The "what am I showing" record, its URL and storage forms |
| `src/hooks/` | `useWeather`, `useGeoName`, `useFavorites` |
| `src/components/` | Navbar, SearchBox, NowPanel, Forecast, HourlyStrip, FavoritesBar, RadarPanel, Skeleton |
| `public/service-worker.js` | Offline caching; shared links resolve to the cached page |
| `public/manifest.json`, `public/icon.svg` | PWA metadata and icon |

## How it works

The data sources, none of which need an account or a key:

- `geocoding-api.open-meteo.com/v1/search` — turns a typed city name into
  coordinates.
- `geocoding-api.open-meteo.com/v1/get` — looks a known place up by id to get its
  name in another language.
- `api.open-meteo.com/v1/forecast` — returns `current`, `daily` and `hourly`
  blocks for those coordinates, with `timezone=auto` and `forecast_days=10`.
- `air-quality-api.open-meteo.com/v1/air-quality` — the European AQI, requested in
  parallel with the forecast. It is optional: if it fails, the tile is left out and
  nothing else is affected.
- `api.rainviewer.com` + `tile.openstreetmap.org` — radar frames and the base map,
  used only while the radar panel is open.

Open-Meteo returns [WMO weather codes](https://open-meteo.com/en/docs); `CODES` in
`src/weatherCodes.js` maps each one to an emoji icon and a label per language, with a
separate night icon for clear and partly-cloudy conditions. `groupFor()` reduces the
same code to one of six background themes.

### State

`App` owns a single `place` — coordinates plus how to name them — and everything else
follows from it. `useWeather(place)` fetches when it changes and keeps the previous
readings on screen during a background refresh, so only a genuine city change shows
the placeholder. Units and language live in a context alongside the formatters bound
to them, so switching either re-renders without refetching.

### The hourly strip

`hoursForDay()` filters the 240 hourly readings down to one day, dropping past hours
when that day is today; `sparkGeometry()` turns the temperatures into an SVG path.
Both are pure functions with unit tests. The curve's geometry depends on the cell
size, so `HOUR_W` and `HOUR_GAP` in `src/hours.js` must stay equal to the width and
gap used by `HourlyStrip`.

### Translations

All interface strings live in `src/i18n.js`, one block per language, each with its
own `locale` used for weekday and date names. A test asserts that both blocks carry
identical keys and that every weather code is labelled in every language.

City names are the one string that cannot come from that table, because they arrive
from the geocoding API in whatever language they were searched in:

- a built-in name (`labelKey`: my location, the default city) is translated locally;
- a searched city carries its Open-Meteo `geoId`, and `useGeoName()` re-fetches the
  name whenever the language changes, caching each id/language pair for the session.
  "Пловдив, България" becomes "Plovdiv, Bulgaria" and back; if the lookup fails, the
  previous name simply stays.

The same hook names the chips in the saved-cities bar.

### Editing notes

- Adding a language: add a block to `I18N` with the same keys and a label per code in
  `CODES`. The toggle builds itself from `LANGS`, and the tests will tell you what is
  missing.
- Changing the hourly strip's cell size: update `HOUR_W`/`HOUR_GAP` and the matching
  classes together, or the curve will drift out of alignment with the cells.
- Adding a weather code: add a row to `CODES` (icon plus a label per language) and,
  if it needs its own background, extend `groupFor()` plus the matching
  `body.weather-*` rule in `src/index.css`.
- Changing the caching rules: bump `CACHE` in `public/service-worker.js`, otherwise
  returning visitors keep the old behaviour. Asset filenames are content-hashed, so
  the worker no longer lists them.

## Tests

`npm test` runs two suites with Vitest:

- `src/__tests__/pure.test.js` — translations, weather codes, conversions, the hourly
  filtering and the curve geometry.
- `src/__tests__/app.test.jsx` — the whole app in jsdom against a stubbed API: the
  loading placeholder, day summaries, the hourly strip starting at the current hour,
  unit and language switching (including the city name), search, saved cities,
  shareable links and the error path.

## Credits

- Weather, geocoding and air quality by [Open-Meteo](https://open-meteo.com/) under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Radar imagery by [RainViewer](https://www.rainviewer.com/), base map
  © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, rendered
  with [Leaflet](https://leafletjs.com/).
