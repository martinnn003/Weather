import { useCallback, useSyncExternalStore } from "react";

// Whether a media query matches, kept current as the window is resized or turned. Where
// there is no matchMedia to ask (jsdom), the answer is `fallback`.
export function useMediaQuery(query, fallback = false) {
  const subscribe = useCallback(notify => {
    const list = window.matchMedia?.(query);
    list?.addEventListener("change", notify);
    return () => list?.removeEventListener("change", notify);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia?.(query).matches ?? fallback);
}
