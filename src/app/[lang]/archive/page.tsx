import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { transliterate } from "@/i18n/localize";
import { formatDateRange } from "@/lib/format";
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
      .select("id, name, location, date_from, date_to, round_number, season_id")
      .eq("status", "finished")
      .order("date_from", { ascending: false }),
    supabase.from("seasons").select("id, year, name").order("year", { ascending: false }),
  ]);

  const text = (value: string) => (lang === "en" ? transliterate(value) : value);
  const yearOf = (date: string) => Number(date.slice(0, 4));
  const years = [...new Set([...(events ?? []).map((event) => yearOf(event.date_from)), ...(seasons ?? []).map((s) => s.year)])].sort(
    (a, b) => b - a,
  );

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">{dict.archive.title}</h1>
        {years.length > 1 && (
          <nav className="mt-4 flex flex-wrap gap-2 text-sm">
            {years.map((year) => (
              <a key={year} href={`#y${year}`} className="rounded-full border border-border px-3 py-1 tabular-nums hover:border-accent">
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
            <section key={year} id={`y${year}`} data-year={year} className="mt-8 scroll-mt-4">
              <h2 className="mb-3 text-xl font-semibold tabular-nums">{year}</h2>
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
                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                  {yearEvents.map((event) => (
                    <li key={event.id}>
                      <Link href={`/${lang}/e/${event.id}`} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 hover:bg-background">
                        <span className="font-medium">{text(event.name)}</span>
                        <span className="text-sm text-muted">
                          {[
                            event.round_number ? t(dict.home.round, { n: event.round_number }) : null,
                            text(event.location),
                            formatDateRange(event.date_from, event.date_to, lang),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </Link>
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
