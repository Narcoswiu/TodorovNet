import Link from "next/link";
import { notFound } from "next/navigation";
import { EventCover } from "@/components/brand/event-cover";
import { EventTile, type EventCard } from "@/components/brand/event-tile";
import { AuthorCard } from "@/components/brand/author-card";
import { StatusBadge } from "@/components/brand/status-badge";
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
      .select("id, name, location, date_from, date_to, status, round_number, image_url")
      .neq("status", "draft")
      .order("date_from", { ascending: false }),
    supabase.from("seasons").select("id, year, name").order("year", { ascending: false }),
  ]);

  const all = events ?? [];
  const live = all.filter((event) => event.status === "live");
  const upcoming = all.filter((event) => event.status === "upcoming").reverse();
  const finished = all.filter((event) => event.status === "finished");
  // The hero shows what matters right now: a live race, else the next one, else the latest result.
  const featured = live[0] ?? upcoming[0] ?? finished[0];
  const rest = (list: EventCard[]) => list.filter((event) => event.id !== featured?.id);
  const text = (value: string) => (lang === "en" ? transliterate(value) : value);

  const groups = [
    { key: "live", title: dict.home.live, list: rest(live) },
    { key: "upcoming", title: dict.home.upcoming, list: rest(upcoming) },
    { key: "finished", title: dict.home.finished, list: rest(finished).slice(0, FINISHED_ON_HOME) },
  ];

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="w-full flex-1">
        {featured ? (
          <section className="relative isolate overflow-hidden">
            <EventCover
              src={featured.image_url}
              alt={text(featured.name)}
              seed={featured.id}
              sizes="100vw"
              priority
              animate
              className="absolute inset-0 -z-10 h-full w-full"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/70 to-background/10" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />
            <div className="mx-auto flex min-h-[26rem] max-w-6xl flex-col justify-end px-4 pb-10 pt-24 sm:min-h-[32rem]">
              <div className="rise flex flex-wrap items-center gap-2" style={{ "--d": "60ms" } as React.CSSProperties}>
                <StatusBadge status={featured.status} dict={dict} />
                {featured.round_number && (
                  <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/80 backdrop-blur">
                    {t(dict.home.round, { n: featured.round_number })}
                  </span>
                )}
              </div>
              <h1
                className="rise font-display mt-4 max-w-3xl text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-7xl"
                style={{ "--d": "140ms" } as React.CSSProperties}
              >
                {text(featured.name)}
              </h1>
              <p className="rise mt-3 text-lg text-white/75" style={{ "--d": "220ms" } as React.CSSProperties}>
                {[text(featured.location), formatDateRange(featured.date_from, featured.date_to, lang)].filter(Boolean).join(" · ")}
              </p>
              <div className="rise mt-6 flex flex-wrap gap-3" style={{ "--d": "300ms" } as React.CSSProperties}>
                <Link
                  href={`/${lang}/e/${featured.id}`}
                  className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-foreground shadow-[0_10px_30px_-10px_var(--accent)] transition-transform hover:scale-[1.03]"
                >
                  {featured.status === "live" ? dict.home.watchLive : dict.home.viewResults} →
                </Link>
                {seasons?.[0] && (
                  <Link
                    href={`/${lang}/s/${seasons[0].id}`}
                    className="rounded-full border border-white/20 bg-white/5 px-6 py-3 font-semibold backdrop-blur transition-colors hover:bg-white/10"
                  >
                    {t(dict.season.heading, { year: seasons[0].year })}
                  </Link>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="mx-auto max-w-6xl px-4 pb-6 pt-20">
            <h1 className="font-display text-5xl font-bold uppercase">{dict.home.heading}</h1>
            <p className="mt-3 text-muted">{dict.home.noEvents}</p>
          </section>
        )}

        <div className="mx-auto max-w-6xl px-4 pb-16">
          {groups.map(({ key, title, list }) =>
            list.length ? (
              <section key={key} className="reveal mt-12">
                <div className="mb-5 flex items-end justify-between gap-3">
                  <h2 className="font-display flex items-center gap-3 text-2xl font-bold uppercase tracking-wide">
                    {key === "live" && <span className="live-dot size-2.5 rounded-full bg-bad" aria-hidden />}
                    {title}
                  </h2>
                  {key === "finished" && (
                    <Link href={`/${lang}/archive`} className="text-sm font-semibold text-accent hover:underline">
                      {dict.home.allFinished} →
                    </Link>
                  )}
                </div>
                <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((event, index) => (
                    <li key={event.id} className="rise" style={{ "--d": `${index * 70}ms` } as React.CSSProperties}>
                      <EventTile event={event} lang={lang} dict={dict} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )}

          {(seasons ?? []).length > 0 && (
            <section className="reveal mt-14">
              <h2 className="font-display mb-5 text-2xl font-bold uppercase tracking-wide">{dict.home.championship}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(seasons ?? []).slice(0, 3).map((season) => (
                  <Link
                    key={season.id}
                    href={`/${lang}/s/${season.id}`}
                    className="card-lift group relative overflow-hidden rounded-2xl border border-border bg-card p-6"
                  >
                    <span className="font-display absolute -right-2 -top-6 text-8xl font-bold text-white/[0.04]">{season.year}</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-accent">{season.name}</span>
                    <span className="font-display mt-2 block text-3xl font-bold">{t(dict.season.heading, { year: season.year })}</span>
                    <span className="mt-4 inline-block text-sm text-muted transition-colors group-hover:text-foreground">
                      {dict.season.individual} · {dict.season.team} →
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <div className="mt-16">
            <AuthorCard dict={dict} />
          </div>
        </div>
      </main>
    </>
  );
}
