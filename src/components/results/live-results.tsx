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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
        <div className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
          <span
            className={`size-2 rounded-full ${
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
        return (
          <section key={cls.id} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{localizedName(cls, lang)}</h2>
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
          <tr key={row.entry_id} className="border-t border-border">
            <td className="py-2 pr-2 text-right font-medium tabular-nums">
              {status === "classified" ? row.position : <StatusLabel status={status} dict={dict} />}
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
        <tr key={row.entry_id} className="border-t border-border">
          <td className="py-2 pr-2 text-right font-medium tabular-nums">{row.position ?? ""}</td>
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
        <tr key={row.entry_id} className="border-t border-border">
          <td className="py-2 pr-2 text-right font-medium tabular-nums">{row.total_points ? row.position : ""}</td>
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
        <tr key={row.entry_id} className="border-t border-border">
          <td className="py-2 pr-2 text-right font-medium tabular-nums">
            {row.result_status === "classified" ? row.position : <StatusLabel status={row.result_status ?? ""} dict={dict} />}
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
    <div className="overflow-x-auto rounded-lg border border-border bg-card px-3">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-xs text-muted">
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
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function RiderCell({ entry, lang }: { entry: EntryInfo | undefined; lang: Locale }) {
  if (!entry) return <td className="py-2 pr-2" />;
  return (
    <td className="w-full py-2 pr-2">
      <div className="font-medium leading-tight">{riderName(entry.first_name, entry.last_name, lang)}</div>
      {entry.club && (
        <div className="text-xs text-muted">{lang === "en" ? transliterate(entry.club) : entry.club}</div>
      )}
    </td>
  );
}

function Plate({ cls, number }: { cls: ClassInfo; number: number | null }) {
  return (
    <span
      className="inline-block min-w-10 rounded border border-border px-1.5 py-0.5 text-center font-mono text-sm font-semibold tabular-nums"
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
      className={`rounded-full border px-3 py-1 text-xs ${
        active ? "border-foreground bg-foreground text-background" : "border-border text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Empty({ dict }: { dict: Dictionary }) {
  return <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted">{dict.common.noData}</p>;
}
