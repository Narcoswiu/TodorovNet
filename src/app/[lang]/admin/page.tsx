import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireViewer } from "@/lib/auth";
import { formatDateRange } from "@/lib/format";

type EventRow = {
  id: number;
  name: string;
  location: string;
  date_from: string;
  date_to: string;
  status: string;
  round_number: number | null;
};

export default async function AdminHomePage({ params }: PageProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const viewer = await requireViewer(lang, `/${lang}/admin`);

  const columns = "id, name, location, date_from, date_to, status, round_number";
  let events: EventRow[];
  if (viewer.isSuperAdmin) {
    const { data } = await viewer.supabase.from("events").select(columns).order("date_from", { ascending: false });
    events = data ?? [];
  } else {
    const { data } = await viewer.supabase.from("event_staff").select(`events(${columns})`).eq("user_id", viewer.userId);
    const unique = new Map<number, EventRow>();
    for (const row of data ?? []) if (row.events) unique.set(row.events.id, row.events);
    events = [...unique.values()].sort((a, b) => b.date_from.localeCompare(a.date_from));
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{dict.admin.manageEvents}</h1>
        {viewer.isSuperAdmin && (
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/${lang}/admin/registry`} className="text-sm text-accent underline">
              {dict.admin.registry.heading}
            </Link>
            <Link
              href={`/${lang}/admin/events/new`}
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
            >
              + {dict.admin.newEvent}
            </Link>
          </div>
        )}
      </div>

      {!events.length && <p className="text-muted">{dict.admin.noEvents}</p>}

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {events.map((event) => (
          <li key={event.id}>
            <Link href={`/${lang}/admin/events/${event.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-background">
              <div>
                <div className="font-medium">{event.name}</div>
                <div className="text-xs text-muted">
                  {[
                    event.round_number ? t(dict.home.round, { n: event.round_number }) : null,
                    event.location,
                    formatDateRange(event.date_from, event.date_to, lang),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <span className="whitespace-nowrap text-xs text-muted">
                {dict.admin.eventStatus[event.status as keyof typeof dict.admin.eventStatus]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
