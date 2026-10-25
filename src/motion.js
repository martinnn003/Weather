// A scroll is a movement like any other on the page, so it follows the same preference.
export const smooth = () =>
  (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
