import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventTile } from "@/components/brand/event-tile";
import { SiteHeader } from "@/components/site-header";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/archive">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getDictionary(lang).archive.title };
}

/** Finished events and championship seasons, newest year first. */
export default async function ArchivePage({ params }: PageProps<"/[lang]/archive">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const supabase = await createClient();

  const [{ data: events }, { data: seasons }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, location, date_from, date_to, round_number, season_id, status, image_url")
      .eq("status", "finished")
      .order("date_from", { ascending: false }),
    supabase.from("seasons").select("id, year, name").order("year", { ascending: false }),
  ]);

  const yearOf = (date: string) => Number(date.slice(0, 4));
  const years = [...new Set([...(events ?? []).map((event) => yearOf(event.date_from)), ...(seasons ?? []).map((s) => s.year)])].sort(
    (a, b) => b - a,
  );

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="rise font-display text-5xl font-bold uppercase tracking-tight">{dict.archive.title}</h1>
        {years.length > 1 && (
          <nav className="mt-4 flex flex-wrap gap-2 text-sm">
            {years.map((year) => (
              <a key={year} href={`#y${year}`} className="font-display rounded-full border border-border bg-card px-4 py-1.5 text-base font-bold tabular-nums transition-colors hover:border-accent hover:text-accent">
                {year}
              </a>
            ))}
          </nav>
        )}
        {!years.length && <p className="mt-4 text-muted">{dict.archive.none}</p>}

        {years.map((year) => {
          const yearSeasons = (seasons ?? []).filter((season) => season.year === year);
          const yearEvents = (events ?? []).filter((event) => yearOf(event.date_from) === year);
          return (
            <section key={year} id={`y${year}`} data-year={year} className="reveal mt-12 scroll-mt-20">
              <h2 className="font-display mb-4 text-4xl font-bold tabular-nums text-white/90">{year}</h2>
              {yearSeasons.length > 0 && (
                <p className="mb-3 flex flex-wrap gap-4 text-sm">
                  {yearSeasons.map((season) => (
                    <Link key={season.id} href={`/${lang}/s/${season.id}`} className="text-accent underline">
                      {t(dict.season.heading, { year: season.year })}
                    </Link>
                  ))}
                </p>
              )}
              {yearEvents.length ? (
                <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {yearEvents.map((event, index) => (
                    <li key={event.id} className="rise" style={{ "--d": `${index * 60}ms` } as React.CSSProperties}>
                      <EventTile event={event} lang={lang} dict={dict} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{dict.archive.noEventsInYear}</p>
              )}
            </section>
          );
        })}
      </main>
    </>
  );
}
