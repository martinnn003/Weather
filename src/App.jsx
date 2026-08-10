import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import Navbar from "./components/Navbar.jsx";
import NowPanel from "./components/NowPanel.jsx";
import Forecast from "./components/Forecast.jsx";
import HourlyStrip from "./components/HourlyStrip.jsx";
import FavoritesBar from "./components/FavoritesBar.jsx";
import Skeleton from "./components/Skeleton.jsx";
import { useSettings } from "./settings.jsx";
import { useWeather } from "./hooks/useWeather.js";
import { useGeoName } from "./hooks/useGeoName.js";
import { useFavorites } from "./hooks/useFavorites.js";
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

  const { data, aqi, error, loading } = useWeather(place);
  const { favorites, toggle, remove } = useFavorites();

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
  // logo, which is not what a logo is for; the 📍 button is there for that.
  const goHome = useCallback(() => {
    setPlace(DEFAULT_PLACE);
    setRadarOpen(false);
    setGeoError(null);
  }, []);

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

      <main className="mx-auto grid w-full max-w-[1150px] flex-1 content-start gap-6 px-4 py-5
        sm:px-6 sm:py-8 lg:grid-cols-[360px_1fr] lg:items-start">
        <FavoritesBar favorites={favorites} current={place} onGo={setPlace} onRemove={remove} />

        {message && (
          <p role="alert" className="text-center text-red-100 lg:col-span-2">{message}</p>
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
            <div className="flex flex-col gap-6">
              <Forecast
                data={data}
                selectedDay={selectedDay}
                onSelect={day => setSelectedDay(current => (current === day ? null : day))}
              />
              {selectedDay !== null && <HourlyStrip data={data} dayIndex={selectedDay} />}
              {radarOpen && (
                <Suspense fallback={<section className="panel opacity-80">{dict.radarLoading}</section>}>
                  <RadarPanel lat={place.lat} lon={place.lon} />
                </Suspense>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="p-6 text-center text-xs opacity-70">
        {dict.footerPrefix}
        <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>
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
