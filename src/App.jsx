import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import Navbar from "./components/Navbar.jsx";
import NowPanel from "./components/NowPanel.jsx";
import Forecast from "./components/Forecast.jsx";
import HourlyStrip from "./components/HourlyStrip.jsx";
import HourlyList from "./components/HourlyList.jsx";
import FavoritesBar from "./components/FavoritesBar.jsx";
import Skeleton from "./components/Skeleton.jsx";
import { useSettings } from "./settings.jsx";
import { useWeather } from "./hooks/useWeather.js";
import { useGeoName } from "./hooks/useGeoName.js";
import { useFavorites } from "./hooks/useFavorites.js";
import { useMediaQuery } from "./hooks/useMediaQuery.js";
import { groupFor } from "./weatherCodes.js";
import { fetchPlace } from "./api.js";
import {
  DEFAULT_PLACE, loadPlace, placeFromCity, placeFromUrl, samePlace, savePlace, syncUrl
} from "./place.js";

const RadarPanel = lazy(() => import("./components/RadarPanel.jsx"));

const firstPlace = () => placeFromUrl(location.pathname, location.search) ?? loadPlace() ?? DEFAULT_PLACE;

export default function App() {
  const { dict, lang, unit } = useSettings(); // `lang` drives the city-name lookup
  const [place, setPlace] = useState(firstPlace);
  const [selectedDay, setSelectedDay] = useState(null);
  const [radarOpen, setRadarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [geoError, setGeoError] = useState(null);

  const { data, aqi, error, loading, reload } = useWeather(place);
  const { favorites, toggle, remove } = useFavorites();
  // Tailwind's sm. Below it the days are a list, ten rows long, and a picked day's hours
  // open under that day instead of under the whole list, off the bottom of the screen.
  const wide = useMediaQuery("(min-width: 40rem)", true);

  // A place found by search carries an id, so its name can follow the language.
  const geoName = useGeoName(place.geoId, lang, place.label);
  const name = place.labelKey ? dict[place.labelKey] : geoName;

  useEffect(() => { setSelectedDay(null); }, [place]);
  useEffect(() => { if (place.lat != null) savePlace(place); }, [place]);
  useEffect(() => { syncUrl(place, name, lang, unit); }, [place, name, lang, unit]);

  // A slug link carries the id and nothing else, so the coordinates are fetched before
  // anything can be shown. An id that no longer resolves leaves the reader at home
  // rather than on an empty page.
  useEffect(() => {
    if (place.lat != null) return;
    let cancelled = false;
    fetchPlace(place.geoId, lang)
      .then(city => {
        if (!cancelled) setPlace({ ...placeFromCity(city), geoId: city.id ?? place.geoId });
      })
      .catch(error => {
        console.error(error);
        if (cancelled) return;
        setPlace(DEFAULT_PLACE);
        setToast(dict.linkFailed);
      });
    return () => { cancelled = true; };
  }, [place, lang, dict]);

  useEffect(() => {
    if (!data) return;
    const night = data.current.is_day === 1 ? "" : " night";
    document.body.className = `weather-${groupFor(data.current.weather_code)}${night}`;
    // The phone's browser bar takes the top of the new sky, so a night page is not
    // crowned with a day's blue.
    const top = getComputedStyle(document.body).getPropertyValue("--sky-top").trim();
    if (top) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", top);
  }, [data]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return setGeoError(dict.geoUnsupported);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      position => setPlace({
        lat: Number(position.coords.latitude.toFixed(2)),
        lon: Number(position.coords.longitude.toFixed(2)),
        label: "", labelKey: "myLocation", geoId: null
      }),
      error => {
        console.error(error);
        setGeoError(dict.geoFailed);
      },
      { timeout: 10000 }
    );
  }, [dict]);

  // Home is the page the app opens on, not the last city looked at — that one is in
  // storage already, so returning to it would leave the brand looking like dead text.
  // Asking the browser for a position instead would put a permission prompt behind a
  // logo, which is not what a logo is for; the 📍 button is there for that. Already at
  // home, the forecast is asked for again: setting the same place changes nothing, so a
  // home page that failed to load would otherwise stay empty under a logo that looks dead.
  const goHome = useCallback(() => {
    if (place === DEFAULT_PLACE) reload();
    else setPlace(DEFAULT_PLACE);
    setSelectedDay(null);
    setRadarOpen(false);
    setGeoError(null);
  }, [place, reload]);

  const share = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setToast(dict.shareCopied);
    } catch (err) {
      console.error(err);
      setToast(dict.shareFailed);
    }
  }, [dict]);

  const saved = favorites.some(f => samePlace(f, place));
  const message = geoError ?? (error ? dict.loadError : null);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar
        onPick={setPlace}
        onLocate={locate}
        onHome={goHome}
        radarOpen={radarOpen}
        onToggleRadar={() => setRadarOpen(open => !open)}
      />

      {/* One stacked column: every panel gets the full width, so the ten days read as a
          single row and the hourly strip has room to scroll inside its own panel
          instead of pushing the page sideways. */}
      <main className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-1 flex-col gap-6
        px-4 py-5 sm:px-6 sm:py-8">
        <FavoritesBar favorites={favorites} current={place} onGo={setPlace} onRemove={remove} />

        {message && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center">
            <p role="alert" className="text-red-100">{message}</p>
            {/* A failed load can be asked again; a refused location is the browser's to change. */}
            {!geoError && (
              <button type="button" onClick={reload}
                className="rounded-xl border border-white/25 bg-white/15 px-3 py-1.5 text-sm
                  transition-colors hover:bg-white/30 focus-visible:outline focus-visible:outline-2
                  focus-visible:outline-offset-2 focus-visible:outline-white/70">
                {dict.retry}
              </button>
            )}
          </div>
        )}

        {!data && loading && <Skeleton />}

        {data && (
          <>
            <NowPanel
              data={data}
              aqi={aqi}
              name={name}
              selectedDay={selectedDay}
              saved={saved}
              onToggleSave={() => toggle(place)}
              onShare={share}
            />
            <Forecast
              data={data}
              selectedDay={selectedDay}
              onSelect={day => setSelectedDay(current => (current === day ? null : day))}
              detail={!wide && selectedDay !== null &&
                <HourlyList data={data} dayIndex={selectedDay} />}
            />
            {wide && selectedDay !== null && <HourlyStrip data={data} dayIndex={selectedDay} />}
            {radarOpen && (
              <Suspense fallback={<section className="panel opacity-80">{dict.radarLoading}</section>}>
                <RadarPanel lat={place.lat} lon={place.lon} />
              </Suspense>
            )}
          </>
        )}
      </main>

      <footer className="p-6 text-center text-xs opacity-70">
        {/* The attribution the models' licences ask for: the lead-in is translated, the
            names of the sources and the licence are the same in every language. */}
        {dict.footerData}{" "}
        <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>
        {" · ICON (DWD), IFS (ECMWF), CAMS (Copernicus), CC BY 4.0"}
      </footer>

      {toast && (
        <div role="status" className="enter fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full
          border border-white/25 bg-[rgba(15,30,45,0.9)] px-4 py-2.5 text-sm">
          {toast}
        </div>
      )}
    </div>
  );
}
