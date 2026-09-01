import { useSettings } from "../settings.jsx";

// Mirrors the real layout so the page does not jump when the data lands.
export default function Skeleton() {
  const { dict } = useSettings();
  return (
    <>
      <section className="panel" role="status" aria-label={dict.loadingLabel}>
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:gap-10">
          <div className="w-full lg:w-[360px] lg:shrink-0 lg:border-r lg:border-white/15 lg:pr-10">
            <div className="skeleton-block mx-auto h-7 w-3/5 lg:mx-0" />
            <div className="skeleton-block mx-auto mt-5 h-18 w-1/2 lg:mx-0" />
            <div className="skeleton-block mx-auto mt-2.5 h-4 w-2/5 lg:mx-0" />
          </div>
          <div className="tiles w-full min-w-0 lg:flex-1 lg:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="skeleton-block h-[74px]" />
            ))}
          </div>
        </div>
      </section>
      <section aria-hidden="true"
        className="panel grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(80px,1fr))]">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="skeleton-block h-[104px]" />
        ))}
      </section>
    </>
  );
}
