import { useSettings } from "../settings.jsx";

// Mirrors the real layout so the page does not jump when the data lands.
export default function Skeleton() {
  const { dict } = useSettings();
  return (
    <>
      <section className="panel text-center" role="status" aria-label={dict.loadingLabel}>
        <div className="skeleton-block mx-auto h-7 w-3/5" />
        <div className="skeleton-block mx-auto mt-5 h-18 w-1/2" />
        <div className="skeleton-block mx-auto mt-2.5 h-4 w-2/5" />
        <div className="tiles">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton-block h-[74px]" />
          ))}
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
