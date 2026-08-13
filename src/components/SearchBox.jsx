import { useEffect, useRef, useState } from "react";
import { searchCities } from "../api.js";
import { useSettings } from "../settings.jsx";
import { placeFromCity } from "../place.js";

export default function SearchBox({ onPick }) {
  const { dict, lang } = useSettings();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = closed, [] = "nothing found"
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(-1);
  const [submitted, setSubmitted] = useState(false); // Enter, pressed before the list arrived
  const boxRef = useRef(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchCities(term, lang)
        .then(found => {
          if (cancelled) return;
          setFailed(false);
          setActive(-1);
          setResults(found);
        })
        .catch(error => {
          if (cancelled) return;
          console.error(error);
          setFailed(true);
          setResults([]);
        });
    }, 300); // one request per pause, not per keystroke
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, lang]);

  useEffect(() => {
    const onClickOutside = e => {
      if (!boxRef.current?.contains(e.target)) setResults(null);
    };
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  const pick = city => {
    setQuery("");
    setResults(null);
    setSubmitted(false);
    onPick(placeFromCity(city));
  };

  // A search runs 300 ms after the last keystroke, so Enter often lands before the list
  // does. Rather than ignore it, the press waits here for the results it asked for.
  useEffect(() => {
    if (!submitted || results === null) return;
    setSubmitted(false);
    if (results.length) pick(results[0]);
  }, [submitted, results]);

  const onKeyDown = e => {
    if (e.key === "Escape") return setResults(null);
    if (e.key === "Enter") {
      e.preventDefault();
      // Nothing highlighted means the top row — the one already on screen. Open-Meteo
      // ranks by significance, and second-guessing that here would only make Enter
      // load a city other than the one being looked at.
      if (results?.length) pick(active >= 0 ? results[active] : results[0]);
      else if (results === null && query.trim().length >= 2) setSubmitted(true);
      return;
    }
    if (!results?.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(i => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(i => (i - 1 + results.length) % results.length);
    }
  };

  const open = results !== null;

  return (
    <div ref={boxRef} className="relative mx-auto max-w-[420px] flex-1">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setSubmitted(false); }}
        onKeyDown={onKeyDown}
        placeholder={dict.searchPlaceholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls="search-results"
        aria-activedescendant={results?.[active] ? `city-${results[active].id}` : undefined}
        aria-autocomplete="list"
        aria-label={dict.searchLabel}
        className="w-full rounded-xl border border-white/35 bg-white/15 px-4 py-2.5
          text-[0.95rem] placeholder:text-white/65 focus:border-white/70 focus:outline-none"
      />
      {open && (
        <ul
          id="search-results"
          role="listbox"
          aria-label={dict.resultsLabel}
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl
            border border-white/25 bg-[rgba(30,90,140,0.97)] text-left"
        >
          {results.length === 0 && (
            <li role="option" aria-selected="false" aria-disabled="true"
              className="px-4 py-2 text-sm opacity-70">
              {failed ? dict.searchFailed : dict.noResults}
            </li>
          )}
          {results.map((city, i) => (
            <li
              key={city.id}
              id={`city-${city.id}`}
              role="option"
              aria-selected={i === active}
              onClick={() => pick(city)}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-4 py-2 text-sm ${i === active ? "bg-white/20" : ""}`}
            >
              {city.name}
              <span className="block text-xs opacity-70">
                {[city.admin1, city.country].filter(Boolean).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
