"use client";

import { useEffect, useMemo, useState } from "react";
import { t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localizedName, riderName, transliterate } from "@/i18n/localize";
import { numberPlateStyle } from "@/lib/classes";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { formatClock, formatDuration, formatGap } from "@/lib/format";
import {
  type ClassInfo,
  type EntryInfo,
  type NavigationRow,
  type StageSelector,
  type StageView,
} from "@/lib/results/queries";
import { PositionBadge } from "@/components/brand/status-badge";
import { createClient } from "@/lib/supabase/client";

type Props = {
  lang: Locale;
  dict: Dictionary;
  eventId: number;
  selector: StageSelector;
  initialView: StageView;
  classes: ClassInfo[];
  entries: EntryInfo[];
  /** Skip realtime and poll (?live=poll): for big screens, and to test the fallback. */
  forcePoll?: boolean;
};

const LIVE_TABLES = ["passings", "laps", "penalties", "rider_statuses", "sessions"] as const;
const STATUS_ORDER = ["classified", "on_course", "nc", "dnf", "dns", "dsq"];
const POLL_MS = 15_000;

export function LiveResults({ lang, dict, eventId, selector, initialView, classes, entries, forcePoll = false }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState(initialView);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [connection, setConnection] = useState<"connecting" | "live" | "polling" | "offline">(
    forcePoll ? "polling" : "connecting",
  );
  const [classFilter, setClassFilter] = useState<number | null>(null);

  const stageId = selector.kind === "round" ? null : selector.stageId;
  const ranking = selector.kind === "round" ? selector.ranking : undefined;

  // Every viewer reads standings through one edge-cached endpoint, so a crowd costs the database about one
  // query every few seconds. Realtime only signals "something changed". When realtime is refused (the plan's
  // connection limit) or switched off, the page polls the same endpoint instead.
  useEffect(() => {
    let disposed = false;
    let polling = forcePoll;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let followUp: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let channel: RealtimeChannel | null = null;
    const query = stageId == null ? `stage=round&ranking=${ranking ?? "points"}` : `stage=${stageId}`;

    const refresh = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch(`/api/live/${eventId}?${query}`);
        if (!response.ok) throw new Error(String(response.status));
        const next = (await response.json()) as StageView;
        if (disposed) return;
        setView(next);
        setUpdatedAt(new Date());
        if (polling) setConnection("polling");
      } catch {
        // Keep showing the last good data; the next change or tick retries.
        if (!disposed && polling) setConnection("offline");
      }
    };
    const schedule = () => {
      clearTimeout(debounce);
      clearTimeout(followUp);
      debounce = setTimeout(refresh, 1000);
      // The edge copy lives a few seconds; a second read picks up the fresh one.
      followUp = setTimeout(refresh, 12_000);
    };
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    if (forcePoll) {
      poll = setInterval(refresh, POLL_MS);
    } else {
      channel = supabase.channel(`event-${eventId}-${stageId ?? "round"}`);
      for (const table of LIVE_TABLES) {
        channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `event_id=eq.${eventId}` }, schedule);
      }
      channel.subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          polling = false;
          clearInterval(poll);
          setConnection("live");
        } else if (!polling) {
          polling = true;
          setConnection("polling");
          poll = setInterval(refresh, POLL_MS);
          refresh();
        }
      });
    }

    // Riders still out when the course closes turn into DNF on the clock, not on an event.
    const tick = setInterval(() => {
      if (!polling) refresh();
    }, 60_000);

    return () => {
      disposed = true;
      clearTimeout(debounce);
      clearTimeout(followUp);
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, eventId, stageId, ranking, forcePoll]);

  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const visibleClasses = classFilter == null ? classes : classes.filter((c) => c.id === classFilter);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-1 flex flex-wrap gap-1">
          <FilterChip active={classFilter == null} onClick={() => setClassFilter(null)}>
            {dict.event.allClasses}
          </FilterChip>
          {classes.map((cls) => (
            <FilterChip key={cls.id} active={classFilter === cls.id} onClick={() => setClassFilter(cls.id)}>
              {localizedName(cls, lang)}
            </FilterChip>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted" aria-live="polite">
          <span
            className={`size-2 rounded-full ${connection === "live" ? "live-dot " : ""}
              connection === "live" || connection === "polling" ? "bg-good" : connection === "offline" ? "bg-warn" : "bg-muted"
            }`}
            aria-hidden
          />
          {connection === "live"
            ? dict.results.live
            : connection === "polling"
              ? dict.results.polling
              : connection === "offline"
              ? dict.common.offline
              : dict.common.connecting}
          {updatedAt && <span>· {t(dict.common.updatedAt, { time: formatClock(updatedAt) })}</span>}
        </div>
      </div>

      {visibleClasses.map((cls) => {
        const table =
          view.kind === "navigation" ? (
            <NavigationTable rows={view.rows.filter((row) => row.class_id === cls.id)} {...{ lang, dict, entryById, cls }} />
          ) : view.kind === "enduro_cross" ? (
            <EnduroCrossTable view={view} {...{ lang, dict, entryById, cls }} />
          ) : view.kind === "round_time" ? (
            <RoundTimeTable rows={view.rows.filter((row) => row.class_id === cls.id)} {...{ lang, dict, entryById, cls }} />
          ) : (
            <RoundTable rows={view.rows.filter((row) => row.class_id === cls.id)} {...{ lang, dict, entryById, cls }} />
          );
        const podium = podiumFor(view, cls.id, dict);
        return (
          <section key={cls.id} className="reveal mb-10">
            <h2 className="font-display mb-3 flex items-center gap-3 text-2xl font-bold uppercase tracking-wide">
              <span className="h-6 w-1.5 rounded-full bg-accent" aria-hidden />
              {localizedName(cls, lang)}
            </h2>
            {podium.length > 0 && <Podium places={podium} entryById={entryById} cls={cls} lang={lang} />}
            {table}
          </section>
        );
      })}

      {view.kind !== "round" && <p className="mt-4 text-xs text-muted">{dict.results.penaltiesNote}</p>}
    </div>
  );
}

type TableProps = {
  lang: Locale;
  dict: Dictionary;
  entryById: Map<number, EntryInfo>;
  cls: ClassInfo;
};

function NavigationTable({ rows, lang, dict, entryById, cls }: TableProps & { rows: NavigationRow[] }) {
  if (!rows.length) return <Empty dict={dict} />;

  const sorted = [...rows].sort((a, b) => {
    const byStatus = STATUS_ORDER.indexOf(a.result_status ?? "") - STATUS_ORDER.indexOf(b.result_status ?? "");
    if (byStatus !== 0) return byStatus;
    if (a.result_status === "classified") return (a.position ?? 0) - (b.position ?? 0);
    if (a.result_status === "on_course") {
      const byControl = (b.last_checkpoint?.sort_order ?? -1) - (a.last_checkpoint?.sort_order ?? -1);
      if (byControl !== 0) return byControl;
      return (a.last_checkpoint?.split_s ?? 0) - (b.last_checkpoint?.split_s ?? 0);
    }
    return (a.race_number ?? 0) - (b.race_number ?? 0);
  });

  return (
    <Table
      head={[dict.results.pos, dict.results.number, dict.results.rider, dict.results.total, dict.results.gap, dict.results.points]}
      hideOnMobile={[4]}
    >
      {sorted.map((row) => {
        const status = row.result_status ?? "";
        return (
          <tr key={row.entry_id} className="border-t border-border/70 transition-colors hover:bg-white/[0.03]">
            <td className="py-2 pr-2 text-right font-medium tabular-nums">
              {status === "classified" ? <PositionBadge position={row.position} /> : <StatusLabel status={status} dict={dict} />}
            </td>
            <td className="py-2 pr-2">
              <Plate cls={cls} number={row.race_number} />
            </td>
            <RiderCell entry={row.entry_id != null ? entryById.get(row.entry_id) : undefined} lang={lang} />
            <td className="py-2 pr-2 text-right font-mono text-sm tabular-nums">
              {status === "classified" || status === "nc" ? (
                <>
                  {formatDuration(row.total_s, { tenths: true })}
                  {(row.penalty_s ?? 0) > 0 && (
                    <div className="text-xs text-bad">+{formatDuration(row.penalty_s)}</div>
                  )}
                </>
              ) : status === "on_course" ? (
                <span className="text-muted">
                  {row.last_checkpoint
                    ? `${row.last_checkpoint.code} ${formatDuration(row.last_checkpoint.split_s)}`
                    : row.scheduled_start
                      ? `${dict.results.start} ${formatClock(row.scheduled_start)}`
                      : dict.results.onCourse}
                </span>
              ) : null}
            </td>
            <td className="hidden py-2 pr-2 text-right font-mono text-sm text-muted tabular-nums sm:table-cell">
              {status === "classified" ? formatGap(row.gap_s) : ""}
            </td>
            <td className="py-2 text-right font-medium tabular-nums">{row.points ? row.points : ""}</td>
          </tr>
        );
      })}
    </Table>
  );
}

function EnduroCrossTable({
  view,
  lang,
  dict,
  entryById,
  cls,
}: TableProps & { view: Extract<StageView, { kind: "enduro_cross" }> }) {
  const heats = view.sessions.filter((s) => s.class_id === cls.id && s.kind === "heat");
  const heatNumbers = [...new Set(heats.map((s) => s.number ?? 0))].sort((a, b) => a - b);
  const overall = view.overall.filter((row) => row.class_id === cls.id);
  const rows = overall.length ? overall : [];
  if (!rows.length && !heats.length) return <Empty dict={dict} />;

  const sorted = [...rows].sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || (a.race_number ?? 0) - (b.race_number ?? 0));

  return (
    <Table
      head={[
        dict.results.pos,
        dict.results.number,
        dict.results.rider,
        ...heatNumbers.map((n) => `H${n}`),
        "Σ",
        dict.results.points,
      ]}
    >
      {sorted.map((row) => (
        <tr key={row.entry_id} className="border-t border-border/70 transition-colors hover:bg-white/[0.03]">
          <td className="py-2 pr-2 text-right font-medium tabular-nums"><PositionBadge position={row.position} /></td>
          <td className="py-2 pr-2">
            <Plate cls={cls} number={row.race_number} />
          </td>
          <RiderCell entry={row.entry_id != null ? entryById.get(row.entry_id) : undefined} lang={lang} />
          {heatNumbers.map((n) => {
            const heat = heats.find((s) => s.entry_id === row.entry_id && s.number === n);
            return (
              <td key={n} className="py-2 pr-2 text-right text-sm tabular-nums">
                {heat?.result_status === "classified" ? (
                  <>
                    {heat.points}
                    <span className="ml-1 text-xs text-muted">({heat.laps})</span>
                  </>
                ) : (
                  <StatusLabel status={heat?.result_status ?? ""} dict={dict} />
                )}
              </td>
            );
          })}
          <td className="py-2 pr-2 text-right text-sm tabular-nums">{row.heat_points}</td>
          <td className="py-2 text-right font-medium tabular-nums">{row.points || ""}</td>
        </tr>
      ))}
    </Table>
  );
}

function RoundTable({
  rows,
  lang,
  dict,
  entryById,
  cls,
}: TableProps & { rows: Extract<StageView, { kind: "round" }>["rows"] }) {
  if (!rows.length) return <Empty dict={dict} />;
  const sorted = [...rows].sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  return (
    <Table head={[dict.results.pos, dict.results.number, dict.results.rider, t(dict.event.day, { n: 1 }), t(dict.event.day, { n: 2 }), dict.results.total]}>
      {sorted.map((row) => (
        <tr key={row.entry_id} className="border-t border-border/70 transition-colors hover:bg-white/[0.03]">
          <td className="py-2 pr-2 text-right font-medium tabular-nums">{row.total_points ? <PositionBadge position={row.position} /> : ""}</td>
          <td className="py-2 pr-2">
            <Plate cls={cls} number={row.race_number} />
          </td>
          <RiderCell entry={row.entry_id != null ? entryById.get(row.entry_id) : undefined} lang={lang} />
          <td className="py-2 pr-2 text-right text-sm tabular-nums">{row.day1_points || ""}</td>
          <td className="py-2 pr-2 text-right text-sm tabular-nums">{row.day2_points || ""}</td>
          <td className="py-2 text-right font-semibold tabular-nums">{row.total_points || ""}</td>
        </tr>
      ))}
    </Table>
  );
}

/** Free events ranked by the sum of navigation totals; unfinished riders listed with their status. */
function RoundTimeTable({
  rows,
  lang,
  dict,
  entryById,
  cls,
}: TableProps & { rows: Extract<StageView, { kind: "round_time" }>["rows"] }) {
  if (!rows.length) return <Empty dict={dict} />;
  const sorted = [...rows].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.result_status ?? "") - STATUS_ORDER.indexOf(b.result_status ?? "") ||
      (a.position ?? 0) - (b.position ?? 0) ||
      (a.race_number ?? 0) - (b.race_number ?? 0),
  );
  return (
    <Table head={[dict.results.pos, dict.results.number, dict.results.rider, dict.results.total, dict.results.gap]}>
      {sorted.map((row) => (
        <tr key={row.entry_id} className="border-t border-border/70 transition-colors hover:bg-white/[0.03]">
          <td className="py-2 pr-2 text-right font-medium tabular-nums">
            {row.result_status === "classified" ? <PositionBadge position={row.position} /> : <StatusLabel status={row.result_status ?? ""} dict={dict} />}
          </td>
          <td className="py-2 pr-2">
            <Plate cls={cls} number={row.race_number} />
          </td>
          <RiderCell entry={row.entry_id != null ? entryById.get(row.entry_id) : undefined} lang={lang} />
          <td className="py-2 pr-2 text-right font-mono text-sm tabular-nums">
            {row.result_status === "classified" ? formatDuration(row.total_s, { tenths: true }) : ""}
            {(row.penalty_s ?? 0) > 0 && <div className="text-xs text-bad">+{formatDuration(row.penalty_s)}</div>}
          </td>
          <td className="py-2 text-right font-mono text-sm text-muted tabular-nums">
            {row.result_status === "classified" ? formatGap(row.gap_s) : ""}
          </td>
        </tr>
      ))}
    </Table>
  );
}

function Table({ head, hideOnMobile = [], children }: { head: string[]; hideOnMobile?: number[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card px-4 shadow-[0_20px_50px_-30px_rgb(0_0_0/0.8)]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[0.7rem] uppercase tracking-wider text-muted">
            {head.map((label, index) => (
              <th
                key={index}
                scope="col"
                className={`whitespace-nowrap py-2 pr-2 font-medium last:pr-0 ${index === 2 ? "text-left" : "text-right"} ${
                  hideOnMobile.includes(index) ? "hidden sm:table-cell" : ""
                }`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="row-in">{children}</tbody>
      </table>
    </div>
  );
}

function RiderCell({ entry, lang }: { entry: EntryInfo | undefined; lang: Locale }) {
  if (!entry) return <td className="py-2 pr-2" />;
  return (
    <td className="w-full py-2 pr-2">
      <div className="font-semibold leading-tight">{riderName(entry.first_name, entry.last_name, lang)}</div>
      {entry.club && (
        <div className="text-xs text-muted">{lang === "en" ? transliterate(entry.club) : entry.club}</div>
      )}
    </td>
  );
}

function Plate({ cls, number }: { cls: ClassInfo; number: number | null }) {
  return (
    <span
      className="font-display inline-block min-w-11 rounded-md border border-white/15 px-1.5 py-0.5 text-center text-base font-bold tabular-nums shadow-inner"
      style={numberPlateStyle(cls.number_bg, cls.number_fg)}
    >
      {number}
    </span>
  );
}

function StatusLabel({ status, dict }: { status: string; dict: Dictionary }) {
  const label = dict.status[status as keyof Dictionary["status"]] ?? "";
  const tone = status === "dsq" || status === "dnf" ? "text-bad" : "text-muted";
  return <span className={`text-xs font-medium ${tone}`}>{label}</span>;
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
        active
          ? "border-accent bg-accent text-accent-foreground shadow-[0_6px_20px_-8px_var(--accent)]"
          : "border-border bg-card text-muted hover:border-white/25 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Empty({ dict }: { dict: Dictionary }) {
  return <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted">{dict.common.noData}</p>;
}

type PodiumPlace = { position: number; entryId: number; headline: string; detail: string };

/** Top three of a class for the podium strip, taken from whatever view is showing. */
function podiumFor(view: StageView, classId: number, dict: Dictionary): PodiumPlace[] {
  const places: PodiumPlace[] = [];
  if (view.kind === "navigation" || view.kind === "round_time") {
    for (const row of view.rows) {
      if (row.class_id !== classId || row.result_status !== "classified" || row.entry_id == null || row.position == null) continue;
      if (row.position > 3) continue;
      places.push({
        position: row.position,
        entryId: row.entry_id,
        headline: formatDuration(row.total_s, { tenths: true }),
        detail: row.position === 1 ? "" : formatGap(row.gap_s),
      });
    }
  } else if (view.kind === "round") {
    for (const row of view.rows) {
      if (row.class_id !== classId || !row.total_points || row.entry_id == null || row.position == null || row.position > 3) continue;
      places.push({ position: row.position, entryId: row.entry_id, headline: `${row.total_points}`, detail: dict.results.points });
    }
  } else {
    for (const row of view.overall) {
      if (row.class_id !== classId || !row.points || row.entry_id == null || row.position == null || row.position > 3) continue;
      places.push({ position: row.position, entryId: row.entry_id, headline: `${row.points}`, detail: dict.results.points });
    }
  }
  return places.sort((a, b) => a.position - b.position);
}

function Podium({
  places,
  entryById,
  cls,
  lang,
}: {
  places: PodiumPlace[];
  entryById: Map<number, EntryInfo>;
  cls: ClassInfo;
  lang: Locale;
}) {
  // Classic podium order on wide screens: 2 · 1 · 3.
  const order = (position: number) => (position === 1 ? "sm:order-2" : position === 2 ? "sm:order-1" : "sm:order-3");
  const tone = (position: number) =>
    position === 1
      ? "from-gold/25 border-gold/60 sm:-translate-y-3"
      : position === 2
        ? "from-silver/20 border-silver/50"
        : "from-bronze/20 border-bronze/50";
  return (
    <ol className="mb-4 grid gap-3 sm:grid-cols-3 sm:items-end">
      {places.map((place, index) => {
        const entry = entryById.get(place.entryId);
        return (
          <li
            key={place.entryId}
            className={`rise relative overflow-hidden rounded-2xl border bg-gradient-to-b to-card p-4 ${order(place.position)} ${tone(place.position)}`}
            style={{ "--d": `${index * 90}ms` } as React.CSSProperties}
          >
            <span className="font-display pointer-events-none absolute -right-1 -top-5 text-8xl font-bold text-white/[0.06]">{place.position}</span>
            <div className="flex items-center gap-3">
              <PositionBadge position={place.position} />
              <Plate cls={cls} number={entry?.race_number ?? null} />
            </div>
            <div className="mt-3 truncate text-lg font-bold leading-tight">
              {entry ? riderName(entry.first_name, entry.last_name, lang) : ""}
            </div>
            {entry?.club && <div className="truncate text-xs text-muted">{lang === "en" ? transliterate(entry.club) : entry.club}</div>}
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold tabular-nums">{place.headline}</span>
              {place.detail && <span className="text-xs text-muted">{place.detail}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
