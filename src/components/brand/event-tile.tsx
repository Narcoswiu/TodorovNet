import Link from "next/link";
import { EventCover } from "@/components/brand/event-cover";
import { StatusBadge } from "@/components/brand/status-badge";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { transliterate } from "@/i18n/localize";
import { formatDateRange } from "@/lib/format";

export type EventCard = {
  id: number;
  name: string;
  location: string;
  date_from: string;
  date_to: string;
  status: string;
  round_number: number | null;
  image_url: string | null;
};

/** Photo card for an event: cover, status, round number, name and dates. */
export function EventTile({ event, lang, dict }: { event: EventCard; lang: Locale; dict: Dictionary }) {
  const text = (value: string) => (lang === "en" ? transliterate(value) : value);
  return (
    <Link href={`/${lang}/e/${event.id}`} className="card-lift group block overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-[16/10]">
        <EventCover src={event.image_url} alt={text(event.name)} seed={event.id} sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
        <div className="absolute left-3 top-3 flex gap-2">
          <StatusBadge status={event.status} dict={dict} />
        </div>
        {event.round_number && (
          <span className="font-display absolute bottom-2 right-3 text-4xl font-bold text-white/85 drop-shadow">R{event.round_number}</span>
        )}
      </div>
      <div className="p-4">
        <div className="font-display text-xl font-bold uppercase leading-tight tracking-wide">{text(event.name)}</div>
        <div className="mt-1 text-sm text-muted">
          {[text(event.location), formatDateRange(event.date_from, event.date_to, lang)].filter(Boolean).join(" · ")}
        </div>
      </div>
    </Link>
  );
}
