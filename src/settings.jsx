import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { I18N, pickLang } from "./i18n.js";
import { formatters } from "./format.js";

const SettingsContext = createContext(null);

// Read on mount, not at import time, so the current URL always wins.
const linkParams = () => new URLSearchParams(location.search);

export function SettingsProvider({ children }) {
  const [lang, setLang] = useState(() =>
    pickLang(linkParams().get("lang"), localStorage.getItem("lang"), navigator.language ?? ""));
  const [unit, setUnit] = useState(() => {
    const fromUrl = linkParams().get("unit");
    if (fromUrl === "c" || fromUrl === "f") return fromUrl;
    return localStorage.getItem("unit") === "f" ? "f" : "c";
  });

  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
    document.title = I18N[lang].title;
  }, [lang]);

  useEffect(() => { localStorage.setItem("unit", unit); }, [unit]);

  const value = useMemo(() => {
    const dict = I18N[lang];
    return { lang, setLang, unit, setUnit, dict, fmt: formatters(unit, dict) };
  }, [lang, unit]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside <SettingsProvider>");
  return value;
}
