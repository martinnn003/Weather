// Readings arrive in metric and are converted on display only.

// Wind direction is where the wind comes FROM; the arrow shows where it blows to.
const ARROWS = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];

export const aqiBand = v => (v <= 20 ? 0 : v <= 40 ? 1 : v <= 60 ? 2 : v <= 80 ? 3 : v <= 100 ? 4 : 5);

export const timeStr = iso => iso.slice(11, 16);

export function formatters(unit, dict) {
  const imperial = unit === "f";
  const conv = c => (imperial ? c * 9 / 5 + 32 : c);
  // Eight compass points, so every direction rounds to the nearest 45°. The arrow and
  // the word are the same reading shown two ways; they share this so they cannot diverge.
  const dir = deg => Math.round(deg / 45) % 8;
  // Every number on the page is written here, in the language's own way: 1,2 on the
  // Bulgarian page, 1.2 on the English one. It is rounded first, as it always was, and
  // only then handed to Intl, so no reading rounds differently; `+ 0` turns a -0 into
  // the 0 it is, and grouping stays off, or English would start writing 1,013 hPa.
  const formats = [];
  const num = (value, digits = 0) => {
    formats[digits] ??= new Intl.NumberFormat(dict.locale,
      { useGrouping: false, minimumFractionDigits: digits, maximumFractionDigits: digits });
    return formats[digits].format((digits ? Number(value.toFixed(digits)) : Math.round(value)) + 0);
  };
  return {
    conv,
    num,
    unitLetter: imperial ? "F" : "C",
    temp: c => `${num(conv(c))}°`,
    wind: kmh => (imperial ? `${num(kmh / 1.609)} mph` : `${num(kmh)} ${dict.units.kmh}`),
    pressure: hPa => (imperial ? `${num(hPa * 0.02953, 2)} inHg` : `${num(hPa)} ${dict.units.hPa}`),
    distance: m => (imperial ? `${num(m / 1609)} mi` : `${num(m / 1000)} ${dict.units.km}`),
    rain: mm => (imperial ? `${num(mm / 25.4, 2)} in` : `${num(mm, 1)} ${dict.units.mm}`),
    percent: p => `${num(p)}%`,
    windArrow: deg => ARROWS[dir(deg)],
    windDir: deg => dict.compass[dir(deg)],
    windLabel: deg => `${dict.wind} · ${dict.compass[dir(deg)]} ${ARROWS[dir(deg)]}`
  };
}
