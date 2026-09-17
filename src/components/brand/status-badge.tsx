import type { Dictionary } from "@/i18n/get-dictionary";

/** Live / upcoming / finished pill. Live pulses. */
export function StatusBadge({ status, dict, className = "" }: { status: string; dict: Dictionary; className?: string }) {
  if (status === "live") {
    return (
      <span className={`inline-flex items-center gap-2 rounded-full bg-bad px-3 py-1 text-xs font-bold uppercase tracking-wider text-white ${className}`}>
        <span className="live-dot size-2 rounded-full bg-white" aria-hidden />
        {dict.home.live}
      </span>
    );
  }
  const label = status === "upcoming" ? dict.home.upcoming : status === "finished" ? dict.home.finished : null;
  if (!label) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur ${
        status === "upcoming" ? "border-accent/60 bg-accent/15 text-accent-2" : "border-white/20 bg-black/40 text-white/80"
      } ${className}`}
    >
      {label}
    </span>
  );
}

/** Gold, silver and bronze for places 1–3; plain for the rest. */
export function PositionBadge({ position }: { position: number | null | undefined }) {
  if (position == null) return null;
  const medal = position === 1 ? "bg-gold text-black" : position === 2 ? "bg-silver text-black" : position === 3 ? "bg-bronze text-black" : "";
  return (
    <span
      className={`inline-grid size-8 place-items-center rounded-full font-display text-base font-bold tabular-nums ${
        medal ? `${medal} shadow-[0_0_18px_-4px_currentColor]` : "text-foreground"
      }`}
    >
      {position}
    </span>
  );
}
