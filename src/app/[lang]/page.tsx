import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { transliterate } from "@/i18n/localize";
import { formatDateRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const FINISHED_ON_HOME = 6;

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);

  const supabase = await createClient();
  const [{ data: events }, { data: seasons }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, location, date_from, date_to, status, round_number")
      .neq("status", "draft")
      .order("date_from", { ascending: false }),
    supabase.from("seasons").select("id, year, name").order("year", { ascending: false }),
  ]);

  const groups = [
    { status: "live", title: dict.home.live },
    { status: "upcoming", title: dict.home.upcoming },
    { status: "finished", title: dict.home.finished },
  ] as const;

  const text = (value: string) => (lang === "en" ? transliterate(value) : value);

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{dict.home.heading}</h1>
          {(seasons ?? []).slice(0, 2).map((season) => (
            <Link key={season.id} href={`/${lang}/s/${season.id}`} className="text-sm text-accent underline">
              {t(dict.season.heading, { year: season.year })}
            </Link>
          ))}
        </div>

        {!events?.length && <p className="text-muted">{dict.home.noEvents}</p>}

        {groups.map(({ status, title }) => {
          const all = (events ?? []).filter((event) => event.status === status);
          // Older results live in the archive, so the home page stays short.
          const list = status === "finished" ? all.slice(0, FINISHED_ON_HOME) : all;
          if (!list.length) return null;
          return (
            <section key={status} className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
                {status === "live" && <span className="size-2 animate-pulse rounded-full bg-bad" aria-hidden />}
                {title}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {list.map((event) => (
                  <li key={event.id}>
                    <Link
                      href={`/${lang}/e/${event.id}`}
                      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent"
                    >
                      <div className="font-medium">{text(event.name)}</div>
                      <div className="mt-1 text-sm text-muted">
                        {[
                          event.round_number ? t(dict.home.round, { n: event.round_number }) : null,
                          text(event.location),
                          formatDateRange(event.date_from, event.date_to, lang),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              {status === "finished" && (
                <Link href={`/${lang}/archive`} className="mt-3 inline-block text-sm text-accent underline">
                  {dict.home.allFinished}
                </Link>
              )}
            </section>
          );
        })}
      </main>
    </>
  );
}
