import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { countAtRedFlag, buildFinalsGrid, buildQualifyingGroups, redFlagNow, restartHeat } from "@/lib/admin/actions/enduro";
import { createSessions } from "@/lib/admin/actions/stages";
import { formatClock, formatDuration, formatLap } from "@/lib/format";

export type EnduroSession = {
  id: number;
  class_id: number;
  kind: string;
  number: number;
  group_label: string | null;
  duration_minutes: number | null;
  started_at: string | null;
  red_flag_at: string | null;
  red_flag_decision: string | null;
};

export type EnduroResult = {
  session_id: number | null;
  entry_id: number | null;
  race_number: number | null;
  laps: number | null;
  best_lap_s: number | null;
  total_s: number | null;
  result_status: string | null;
  position: number | null;
  points: number | null;
};

type Props = {
  lang: Locale;
  dict: Dictionary;
  eventId: number;
  stageId: number;
  classes: { id: number; name: string }[];
  sessions: EnduroSession[];
  results: EnduroResult[];
  grid: Map<string, number>;
  riderNames: Map<number, string>;
};

/** Qualifying groups, finals grid, per-session state (start, red flag) and live session results. */
export function EnduroSessions({ lang, dict, eventId, stageId, classes, sessions, results, grid, riderNames }: Props) {
  const s = dict.admin.stages;
  const hidden = (
    <>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="stage_id" value={stageId} />
    </>
  );
  const statusLabel = (status: string | null) => dict.status[(status ?? "") as keyof Dictionary["status"]] ?? status ?? "";

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <ActionForm action={createSessions} submitLabel={s.createSessions} pendingLabel={dict.common.loading}>
          {hidden}
        </ActionForm>
        <ActionForm action={buildQualifyingGroups} submitLabel={s.buildGroups} pendingLabel={dict.common.loading}>
          {hidden}
        </ActionForm>
        <ActionForm action={buildFinalsGrid} submitLabel={s.buildGrid} pendingLabel={dict.common.loading}>
          {hidden}
        </ActionForm>
      </div>

      {classes.map((cls) => {
        const classSessions = sessions.filter((session) => session.class_id === cls.id);
        if (!classSessions.length) return null;
        return (
          <div key={cls.id} className="mb-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{cls.name}</h3>
            {classSessions.map((session) => {
              const label = `${session.kind === "qualifying" ? "Q" : `H${session.number}`}${session.group_label ? ` ${session.group_label}` : ""}`;
              const rows = results
                .filter((row) => row.session_id === session.id)
                .sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || (a.race_number ?? 0) - (b.race_number ?? 0));
              return (
                <div key={session.id} className="mb-3 rounded-md border border-border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      <span className="font-semibold">{label}</span>
                      <span className="ml-2 text-muted">
                        {session.duration_minutes} {s.duration}
                        {" · "}
                        {session.started_at ? t(s.startedAt, { time: formatClock(session.started_at) }) : s.notStarted}
                      </span>
                      {session.red_flag_at && (
                        <span className="ml-2 font-medium text-bad">
                          {t(s.redFlagAt, { time: formatClock(session.red_flag_at) })}
                          {session.red_flag_decision === "count" && ` · ${s.countAtFlag}`}
                        </span>
                      )}
                    </span>
                    <span className="flex flex-wrap gap-2">
                      {session.started_at && !session.red_flag_at && (
                        <ActionButton action={redFlagNow} fields={{ lang, session_id: session.id }} label={s.redFlag} pendingLabel="…" tone="bad" />
                      )}
                      {session.red_flag_at && session.red_flag_decision !== "count" && (
                        <ActionButton action={countAtRedFlag} fields={{ lang, session_id: session.id }} label={s.countAtFlag} pendingLabel="…" />
                      )}
                      {session.red_flag_at && (
                        <ActionButton action={restartHeat} fields={{ lang, session_id: session.id }} label={s.restartHeat} pendingLabel="…" tone="bad" />
                      )}
                    </span>
                  </div>
                  {rows.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-muted">
                          <tr>
                            <th className="py-1 pr-2 text-right font-medium">{dict.results.pos}</th>
                            <th className="py-1 pr-2 text-right font-medium">{dict.results.number}</th>
                            <th className="py-1 pr-2 text-left font-medium">{dict.results.rider}</th>
                            {session.kind === "heat" && <th className="py-1 pr-2 text-right font-medium">{s.grid}</th>}
                            <th className="py-1 pr-2 text-right font-medium">{dict.results.laps}</th>
                            <th className="py-1 pr-2 text-right font-medium">{dict.results.bestLap}</th>
                            <th className="py-1 pr-2 text-right font-medium">{dict.results.total}</th>
                            {session.kind === "heat" && <th className="py-1 text-right font-medium">{dict.results.points}</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.entry_id} className="border-t border-border">
                              <td className="py-1 pr-2 text-right font-medium tabular-nums">
                                {row.result_status === "classified" ? row.position : statusLabel(row.result_status)}
                              </td>
                              <td className="py-1 pr-2 text-right font-mono tabular-nums">{row.race_number}</td>
                              <td className="py-1 pr-2">{riderNames.get(row.entry_id ?? 0)}</td>
                              {session.kind === "heat" && (
                                <td className="py-1 pr-2 text-right tabular-nums text-muted">{grid.get(`${session.id}:${row.entry_id}`) ?? ""}</td>
                              )}
                              <td className="py-1 pr-2 text-right tabular-nums">{row.laps}</td>
                              <td className="py-1 pr-2 text-right font-mono tabular-nums">{formatLap(row.best_lap_s)}</td>
                              <td className="py-1 pr-2 text-right font-mono tabular-nums">
                                {session.kind === "heat" ? formatDuration(row.total_s, { tenths: true }) : ""}
                              </td>
                              {session.kind === "heat" && <td className="py-1 text-right font-semibold tabular-nums">{row.points || ""}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
