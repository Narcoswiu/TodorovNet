import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventCover } from "@/components/brand/event-cover";
import { StatusBadge } from "@/components/brand/status-badge";
import { LiveResults } from "@/components/results/live-results";
import { StartList } from "@/components/results/start-list";
import { SiteHeader } from "@/components/site-header";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { stageName, transliterate } from "@/i18n/localize";
import { formatClock, formatDateRange } from "@/lib/format";
import { loadClasses, loadEntries, loadStartList, loadView, type StageSelector } from "@/lib/results/queries";
import { createClient } from "@/lib/supabase/server";

async function loadEvent(eventId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, location, date_from, date_to, status, round_number, season_id, kind, ranking, image_url")
    .eq("id", eventId)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/e/[eventId]">): Promise<Metadata> {
  const { lang, eventId } = await params;
  const event = await loadEvent(Number(eventId));
  if (!event || !hasLocale(lang)) return {};
  return { title: lang === "en" ? transliterate(event.name) : event.name };
}

export default async function EventPage({ params, searchParams }: PageProps<"/[lang]/e/[eventId]">) {
  const { lang, eventId: rawEventId } = await params;
  if (!hasLocale(lang)) notFound();
  const eventId = Number(rawEventId);
  if (!Number.isInteger(eventId)) notFound();

  const dict = getDictionary(lang);
  const supabase = await createClient();

  const [event, stagesResult, classes, entries] = await Promise.all([
    loadEvent(eventId),
    supabase
      .from("stages")
      .select("id, name, name_en, type, day_number, sort_order, course_closes_at")
      .eq("event_id", eventId)
      .in("type", ["navigation", "enduro_cross"])
      .order("day_number")
      .order("sort_order"),
    loadClasses(supabase, eventId),
    loadEntries(supabase, eventId),
  ]);
  if (!event) notFound();

  const stages = stagesResult.data ?? [];
  const { stage: stageParam, view: viewParam, live: liveParam } = await searchParams;
  const requested = typeof stageParam === "string" ? stageParam : undefined;
  const selectedStage = stages.find((stage) => String(stage.id) === requested) ?? (requested === "round" ? null : stages[0]);

  const selector: StageSelector = selectedStage
    ? { kind: selectedStage.type === "enduro_cross" ? "enduro_cross" : "navigation", stageId: selectedStage.id }
    : { kind: "round", ranking: event.ranking === "time" ? "time" : "points" };
  const showStartList = viewParam === "start" && selectedStage?.type === "navigation";
  const [view, startSlots, { data: latestPublications }] = await Promise.all([
    showStartList ? null : loadView(supabase, eventId, selector),
    showStartList && selectedStage ? loadStartList(supabase, selectedStage.id) : null,
    supabase
      .from("publications")
      .select("id, stage_id, state, version, published_at, protest_deadline_at, published_by_name")
      .eq("event_id", eventId)
      .order("published_at", { ascending: false })
      .order("version", { ascending: false }),
  ]);
  const publication = (latestPublications ?? []).find((pub) => pub.stage_id === (selectedStage?.id ?? null));

  const text = (value: string) => (lang === "en" ? transliterate(value) : value);
  const tabClass = (active: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-foreground text-background shadow-[0_6px_20px_-8px_rgb(255_255_255/0.5)]" : "text-muted hover:bg-white/5 hover:text-foreground"
    }`;
  const days = new Set(stages.map((stage) => stage.day_number)).size;
  const stats = [
    { value: entries.length, label: dict.event.statRiders },
    { value: classes.length, label: dict.event.statClasses },
    { value: stages.length, label: dict.event.statStages },
    { value: days, label: dict.event.statDays },
  ];

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <section className="relative isolate overflow-hidden border-b border-white/5">
        <EventCover
          src={event.image_url}
          alt={text(event.name)}
          seed={event.id}
          sizes="100vw"
          priority
          animate
          className="absolute inset-0 -z-10 h-full w-full"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/75 to-background/20" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background/85 to-transparent" />
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-16 sm:pt-24">
          <div className="rise flex flex-wrap items-center gap-2">
            <StatusBadge status={event.status} dict={dict} />
            {event.round_number && (
              <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/80 backdrop-blur">
                {t(dict.home.round, { n: event.round_number })}
              </span>
            )}
          </div>
          <h1
            className="rise font-display mt-3 max-w-4xl text-4xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl"
            style={{ "--d": "80ms" } as React.CSSProperties}
          >
            {text(event.name)}
          </h1>
          <p className="rise mt-2 text-white/75" style={{ "--d": "140ms" } as React.CSSProperties}>
            {[text(event.location), formatDateRange(event.date_from, event.date_to, lang)].filter(Boolean).join(" · ")}
            {event.kind === "championship_round" && event.season_id && (
              <>
                {" · "}
                <Link href={`/${lang}/s/${event.season_id}`} className="font-semibold text-accent hover:underline">
                  {dict.season.link} →
                </Link>
              </>
            )}
          </p>
          <dl className="rise mt-6 grid max-w-2xl grid-cols-4 gap-2" style={{ "--d": "200ms" } as React.CSSProperties}>
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 backdrop-blur">
                <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-white/60">{stat.label}</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <nav
          className="sticky top-[3.6rem] z-20 -mx-4 mb-5 flex gap-1 overflow-x-auto bg-background/80 px-4 py-2 backdrop-blur-xl"
          aria-label={dict.event.standings}
        >
          {stages.map((stage) => (
            <Link key={stage.id} href={`?stage=${stage.id}`} className={tabClass(stage.id === selectedStage?.id)}>
              {stageName(stage, lang, { day: dict.event.day, stageType: dict.stageType })}
            </Link>
          ))}
          {stages.length > 0 && (
            <Link href="?stage=round" className={tabClass(!selectedStage)}>
              {dict.results.total}
            </Link>
          )}
        </nav>

        {selectedStage?.type === "navigation" && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex rounded-full border border-border bg-card p-0.5 text-xs font-semibold">
              <Link
                href={`?stage=${selectedStage.id}`}
                aria-current={!showStartList ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 transition-colors ${!showStartList ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"}`}
              >
                {dict.event.standings}
              </Link>
              <Link
                href={`?stage=${selectedStage.id}&view=start`}
                aria-current={showStartList ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 transition-colors ${showStartList ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"}`}
              >
                {dict.event.startList}
              </Link>
            </div>
            {selectedStage.course_closes_at && (
              <p className="text-xs text-muted">
                {t(dict.event.closesAt, { time: formatClock(selectedStage.course_closes_at) })}
              </p>
            )}
          </div>
        )}

        {showStartList && selectedStage ? (
          <>
            {(startSlots?.length ?? 0) > 0 && (
              <p className="mb-3 text-sm">
                <a href={`/api/pdf/start-list/${selectedStage.id}?lang=${lang}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 font-semibold hover:border-accent">
                  {dict.pdf.startList} · PDF
                </a>
              </p>
            )}
            <StartList lang={lang} dict={dict} slots={startSlots ?? []} classes={classes} entries={entries} />
          </>
        ) : (
          view && (
            <>
            <div
              className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm ${
                publication?.state === "official"
                  ? "border-good/50 bg-good/10 text-good"
                  : publication
                    ? "border-warn/50 bg-warn/10 text-warn"
                    : "border-border bg-card text-muted"
              }`}
            >
              <span>
                {publication ? (
                  <>
                    <span className="font-medium">
                      {publication.state === "official" ? dict.publication.official : dict.publication.provisional}
                    </span>{" "}
                    · {t(dict.publication.version, { n: publication.version })} ·{" "}
                    {t(dict.publication.publishedAt, { time: formatClock(publication.published_at) })}
                    {publication.protest_deadline_at &&
                      ` · ${t(dict.publication.deadline, { time: formatClock(publication.protest_deadline_at) })}`}
                  </>
                ) : (
                  dict.publication.live
                )}
              </span>
              {publication && (
                <a href={`/api/pdf/publication/${publication.id}?lang=${lang}`} target="_blank" rel="noreferrer" className="rounded-full border border-current px-3 py-1 font-semibold">
                  {dict.publication.pdf}
                </a>
              )}
            </div>
            <LiveResults
              key={selectedStage ? selectedStage.id : "round"}
              lang={lang}
              dict={dict}
              eventId={eventId}
              selector={selector}
              initialView={view}
              classes={classes}
              entries={entries}
              forcePoll={liveParam === "poll"}
            />
            </>
          )
        )}
      </main>
    </>
  );
}
