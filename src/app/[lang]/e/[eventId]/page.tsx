import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveResults } from "@/components/results/live-results";
import { SiteHeader } from "@/components/site-header";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { stageName, transliterate } from "@/i18n/localize";
import { formatClock, formatDateRange } from "@/lib/format";
import { loadClasses, loadEntries, loadView, type StageSelector } from "@/lib/results/queries";
import { createClient } from "@/lib/supabase/server";

async function loadEvent(eventId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, location, date_from, date_to, status, round_number")
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
  const { stage: stageParam } = await searchParams;
  const requested = typeof stageParam === "string" ? stageParam : undefined;
  const selectedStage = stages.find((stage) => String(stage.id) === requested) ?? (requested === "round" ? null : stages[0]);

  const selector: StageSelector = selectedStage
    ? { kind: selectedStage.type === "enduro_cross" ? "enduro_cross" : "navigation", stageId: selectedStage.id }
    : { kind: "round" };
  const view = await loadView(supabase, eventId, selector);

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

        {selectedStage?.course_closes_at && (
          <p className="mb-3 text-xs text-muted">
            {t(dict.event.closesAt, { time: formatClock(selectedStage.course_closes_at) })}
          </p>
        )}

        <LiveResults
          key={selectedStage ? selectedStage.id : "round"}
          lang={lang}
          dict={dict}
          eventId={eventId}
          selector={selector}
          initialView={view}
          classes={classes}
          entries={entries}
        />
      </main>
    </>
  );
}
