import SearchBox from "./SearchBox.jsx";
import { useSettings } from "../settings.jsx";
import { LANGS } from "../i18n.js";

function SegToggle({ label, options, value, onChange }) {
  return (
    <div className="seg-toggle" role="group" aria-label={label}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          lang={option.lang}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.text}
        </button>
      ))}
    </div>
  );
}

export default function Navbar({ onPick, onLocate, onHome, radarOpen, onToggleRadar }) {
  const { dict, lang, setLang, unit, setUnit } = useSettings();

  // A real link, so it can be opened in a tab or copied; a plain click is handled in
  // the app instead, which resets the view without paying for a full reload.
  const home = e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onHome();
  };

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-white/20
      bg-white/10 px-4 py-3 backdrop-blur-md sm:gap-4 sm:px-7">
      <a
        href="./"
        onClick={home}
        aria-label={dict.homeLabel}
        className="mr-auto rounded-lg text-lg font-bold whitespace-nowrap transition
          hover:opacity-75 focus-visible:outline focus-visible:outline-2
          focus-visible:outline-offset-2 focus-visible:outline-white/70 sm:mr-0"
      >
        {dict.brand}
      </a>

      <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
        <SearchBox onPick={onPick} />
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <button type="button" className="icon-btn" title={dict.geoLabel}
          aria-label={dict.geoLabel} onClick={onLocate}>📍</button>
        <button type="button" className="icon-btn" title={dict.radarLabel}
          aria-label={dict.radarLabel} aria-pressed={radarOpen} onClick={onToggleRadar}>🛰️</button>

        <SegToggle
          label={dict.unitLabel}
          value={unit}
          onChange={setUnit}
          options={[{ value: "c", text: "°C" }, { value: "f", text: "°F" }]}
        />
        <SegToggle
          label={dict.langLabel}
          value={lang}
          onChange={setLang}
          options={[...LANGS].sort().map(code => ({ // БГ first, then EN
            value: code,
            lang: code,
            text: code === "bg" ? "БГ" : "EN"
          }))}
        />
      </div>
    </header>
  );
}
