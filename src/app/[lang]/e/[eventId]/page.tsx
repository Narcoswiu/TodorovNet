import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
    .select("id, name, location, date_from, date_to, status, round_number, season_id, kind, ranking")
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
      .order("published_at", { ascending: false }),
  ]);
  const publication = (latestPublications ?? []).find((pub) => pub.stage_id === (selectedStage?.id ?? null));

  const text = (value: string) => (lang === "en" ? transliterate(value) : value);
  const tabClass = (active: boolean) =>
    `whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
      active ? "bg-foreground text-background" : "text-muted hover:bg-card hover:text-foreground"
    }`;

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight">{text(event.name)}</h1>
          <p className="mt-1 text-sm text-muted">
            {[
              event.round_number ? t(dict.home.round, { n: event.round_number }) : null,
              text(event.location),
              formatDateRange(event.date_from, event.date_to, lang),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {event.kind === "championship_round" && event.season_id && (
            <Link href={`/${lang}/s/${event.season_id}`} className="mt-1 inline-block text-sm text-accent underline">
              {dict.season.link}
            </Link>
          )}
        </div>

        <nav className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4" aria-label={dict.event.standings}>
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
            <div className="flex rounded-md border border-border text-xs font-medium">
              <Link
                href={`?stage=${selectedStage.id}`}
                aria-current={!showStartList ? "page" : undefined}
                className={`rounded-l-md px-3 py-1 ${!showStartList ? "bg-foreground text-background" : "text-muted"}`}
              >
                {dict.event.standings}
              </Link>
              <Link
                href={`?stage=${selectedStage.id}&view=start`}
                aria-current={showStartList ? "page" : undefined}
                className={`rounded-r-md px-3 py-1 ${showStartList ? "bg-foreground text-background" : "text-muted"}`}
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
                <a href={`/api/pdf/start-list/${selectedStage.id}?lang=${lang}`} target="_blank" rel="noreferrer" className="text-accent underline">
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
              className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
                publication?.state === "official"
                  ? "border-good text-good"
                  : publication
                    ? "border-warn text-warn"
                    : "border-border text-muted"
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
                <a href={`/api/pdf/publication/${publication.id}?lang=${lang}`} target="_blank" rel="noreferrer" className="underline">
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
