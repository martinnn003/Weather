import { useEffect, useState } from "react";
import { useSettings } from "../settings.jsx";
import { smooth } from "../motion.js";

// Phones only. There the days are a list and a picked day's hours open under it, so the
// page runs three or four screens long, and Android has no tap on the clock to climb
// back. The navbar stays on screen, so what the button brings back is the top panel.
// It shows past the first screen, where there is something to go back to, and fades
// rather than vanishing, like the strip's arrows; hidden, it cannot be pressed or reached.
export default function BackToTop() {
  const { dict } = useSettings();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const check = () => setShown(window.scrollY > window.innerHeight);
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <button
      type="button"
      disabled={!shown}
      aria-hidden={!shown}
      title={dict.backToTop}
      aria-label={dict.backToTop}
      onClick={() => window.scrollTo({ top: 0, behavior: smooth() })}
      className={`fixed right-4 bottom-6 z-30 grid h-11 w-11 place-items-center rounded-full
        border border-white/30 bg-white/25 shadow-lg backdrop-blur-md transition duration-200
        hover:bg-white/40 ${shown ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 15l6-6 6 6" />
      </svg>
    </button>
  );
}
