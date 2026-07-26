import { useSettings } from "../settings.jsx";
import { useGeoName } from "../hooks/useGeoName.js";
import { samePlace } from "../place.js";

function Chip({ place, active, onGo, onRemove }) {
  const { dict, lang } = useSettings();
  const geoName = useGeoName(place.geoId, lang, place.label);
  const name = place.labelKey ? dict[place.labelKey] : geoName;

  return (
    <span className={`flex items-center rounded-full border border-white/20 backdrop-blur-md
      ${active ? "bg-white/30" : "bg-white/15"}`}>
      <button type="button" onClick={onGo}
        className="cursor-pointer py-1.5 pr-1 pl-3.5 text-sm whitespace-nowrap">
        {name}
      </button>
      <button type="button" onClick={onRemove} title={dict.favRemoveOne(name)}
        aria-label={dict.favRemoveOne(name)}
        className="cursor-pointer py-1.5 pr-3 pl-1.5 leading-none opacity-65 hover:opacity-100">
        ×
      </button>
    </span>
  );
}

export default function FavoritesBar({ favorites, current, onGo, onRemove }) {
  const { dict } = useSettings();
  if (!favorites.length) return null;

  return (
    <nav aria-label={dict.favLabel} className="flex flex-wrap gap-2 lg:col-span-2">
      {favorites.map((place, i) => (
        <Chip
          key={place.geoId ?? `${place.lat},${place.lon}`}
          place={place}
          active={samePlace(place, current)}
          onGo={() => onGo(place)}
          onRemove={() => onRemove(i)}
        />
      ))}
    </nav>
  );
}
