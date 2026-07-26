// Readings arrive in metric and are converted on display only.

// Wind direction is where the wind comes FROM; the arrow shows where it blows to.
const ARROWS = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];

export const aqiBand = v => (v <= 20 ? 0 : v <= 40 ? 1 : v <= 60 ? 2 : v <= 80 ? 3 : v <= 100 ? 4 : 5);

export const timeStr = iso => iso.slice(11, 16);

export function formatters(unit, dict) {
  const imperial = unit === "f";
  const conv = c => (imperial ? c * 9 / 5 + 32 : c);
  return {
    conv,
    unitLetter: imperial ? "F" : "C",
    temp: c => `${Math.round(conv(c))}°`,
    wind: kmh => (imperial ? `${Math.round(kmh / 1.609)} mph` : `${Math.round(kmh)} km/h`),
    pressure: hPa => (imperial ? `${(hPa * 0.02953).toFixed(2)} inHg` : `${Math.round(hPa)} hPa`),
    distance: m => (imperial ? `${Math.round(m / 1609)} mi` : `${Math.round(m / 1000)} km`),
    rain: mm => (imperial ? `${(mm / 25.4).toFixed(2)} in` : `${mm.toFixed(1)} mm`),
    windLabel: deg => {
      const i = Math.round(deg / 45) % 8;
      return `${dict.wind} · ${dict.compass[i]} ${ARROWS[i]}`;
    }
  };
}
