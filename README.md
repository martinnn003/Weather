# ☀️ Weather

A weather app in plain HTML, CSS and JavaScript: current conditions, a 10-day
forecast, an hourly breakdown and a precipitation radar for any city in the world.
No build step, no framework, no API key.

Live data comes from [Open-Meteo](https://open-meteo.com/) (free, no registration).
The only third-party code is Leaflet, and it is fetched on demand the first time you
open the radar — everything else runs with zero dependencies.

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

Any static file server works. The service worker and geolocation require
`http://localhost` or HTTPS, so opening `index.html` via `file://` will load the
weather but skip those two features.

```bash
python -m http.server 8000
# or: npx serve .
```

Then open <http://localhost:8000>.

Because it is fully static, it can be deployed as-is to GitHub Pages, Netlify,
Cloudflare Pages or any other static host.

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | Markup, meta tags, PWA manifest link |
| `styles.css` | Layout, weather-dependent gradients, responsive breakpoints |
| `script.js` | Translations, API calls, rendering, search, units, geolocation, state |
| `service-worker.js` | Offline caching (cache-first shell, network-first API); shared links resolve to the cached page |
| `manifest.json` | PWA metadata for installation |
| `icon.svg` | App icon / favicon |

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

Open-Meteo returns [WMO weather codes](https://open-meteo.com/en/docs); the `CODES`
table at the top of `script.js` maps each one to a label and an emoji icon, with a
separate night icon for clear and partly-cloudy conditions. `groupFor()` reduces the
same code to one of six background themes.

Everything renders from a single `state` object holding the last API response, the
coordinates and the display label, so switching units, language or selected day
simply re-renders — no refetch.

### The hourly strip

`renderHours()` filters the 240 hourly readings down to one day, dropping past hours
when that day is today, and emits an SVG curve plus one cell per hour inside a shared
horizontal scroller. The curve's geometry depends on the cell size, so `HOUR_W` and
`HOUR_GAP` in `script.js` must stay equal to `.hour`'s width and `.hours`'s gap in
`styles.css`.

### Translations

All interface strings live in the `I18N` table at the top of `script.js`, one block
per language (`en`, `bg`), each with its own `locale` used for weekday names.
`applyLang()` writes every static string, `aria-label`, `<title>` and `<html lang>`,
then re-renders. Weather descriptions sit alongside the icons in `CODES`, so each WMO
code carries both an English and a Bulgarian label.

The heading is the one string that cannot be translated from a table, so `state`
tracks where it came from:

- `labelKey` — a built-in label ("My Location", the default city), swapped locally.
- `geoId` — a searched city. Switching language re-fetches it from
  `geocoding-api.open-meteo.com/v1/get?id=…`, so "Пловдив, България" becomes
  "Plovdiv, Bulgaria" and back. If that request fails the previous name simply stays.
- `labelLang` — the language the current name was fetched in, so the round trip only
  happens when it is actually needed (including on load, if the language changed
  since the city was saved).

### Editing notes

- Adding a language: add a block to `I18N` with the same keys, a label per code in
  `CODES`, and a button wired to `setLang()`.
- Changing the hourly strip's cell size: update `HOUR_W`/`HOUR_GAP` and `styles.css`
  together, or the curve will drift out of alignment with the cells.
- Adding a weather code: add a row to `CODES` (icon plus a label per language) and,
  if it needs its own background, extend `groupFor()` plus the matching
  `body.weather-*` rule in `styles.css`.
- Changing the app shell: bump the `CACHE` version in `service-worker.js`, otherwise
  returning visitors keep the old cached files.

## Credits

- Weather, geocoding and air quality by [Open-Meteo](https://open-meteo.com/) under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Radar imagery by [RainViewer](https://www.rainviewer.com/), base map
  © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, rendered
  with [Leaflet](https://leafletjs.com/).
