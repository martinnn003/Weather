# ☀️ Weather

A dependency-free weather app: current conditions, a 10-day forecast and an hourly
breakdown for any city in the world. Plain HTML, CSS and JavaScript — no build step,
no framework, no API key.

Live data comes from [Open-Meteo](https://open-meteo.com/) (free, no registration).

## Features

- **Bilingual — Bulgarian and English** — the БГ/EN toggle switches the whole
  interface: labels, weather descriptions, weekday names, errors and city search
  results (Open-Meteo returns localised place names). The language defaults to the
  browser's and is remembered.
- **Current conditions** — temperature, feels-like, humidity, wind, UV index,
  precipitation chance, sunrise and sunset.
- **10-day forecast** — click (or press Enter/Space on) any day to expand its
  hourly breakdown; click again to collapse.
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
| `service-worker.js` | Offline caching (cache-first shell, network-first API) |
| `manifest.json` | PWA metadata for installation |
| `icon.svg` | App icon / favicon |

## How it works

Two Open-Meteo endpoints are used, both without authentication:

- `geocoding-api.open-meteo.com/v1/search` — turns a typed city name into
  coordinates.
- `api.open-meteo.com/v1/forecast` — returns `current`, `daily` and `hourly`
  blocks for those coordinates, with `timezone=auto` and `forecast_days=10`.

Open-Meteo returns [WMO weather codes](https://open-meteo.com/en/docs); the `CODES`
table at the top of `script.js` maps each one to a label and an emoji icon, with a
separate night icon for clear and partly-cloudy conditions. `groupFor()` reduces the
same code to one of six background themes.

Everything renders from a single `state` object holding the last API response, the
coordinates and the display label, so switching units or language simply re-renders —
no refetch.

### Translations

All interface strings live in the `I18N` table at the top of `script.js`, one block
per language (`en`, `bg`), each with its own `locale` used for weekday names.
`applyLang()` writes every static string, `aria-label`, `<title>` and `<html lang>`,
then re-renders. Weather descriptions sit alongside the icons in `CODES`, so each WMO
code carries both an English and a Bulgarian label.

Two labels are not city names — "My Location" and the default city — so `state`
stores a `labelKey` for them and they follow the language too. City names found via
search keep whatever the geocoding API returned.

### Editing notes

- Adding a language: add a block to `I18N` with the same keys, a label per code in
  `CODES`, and a button wired to `setLang()`.
- Adding a weather code: add a row to `CODES` (icon plus a label per language) and,
  if it needs its own background, extend `groupFor()` plus the matching
  `body.weather-*` rule in `styles.css`.
- Changing the app shell: bump the `CACHE` version in `service-worker.js`, otherwise
  returning visitors keep the old cached files.

## Credits

Weather data by [Open-Meteo](https://open-meteo.com/) under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
