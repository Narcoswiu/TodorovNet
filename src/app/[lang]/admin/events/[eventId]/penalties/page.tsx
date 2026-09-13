import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { Card, SelectField, TextField } from "@/components/admin/fields";
import { hasLocale, t } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { getDictionary } from "@/i18n/get-dictionary";
import { localizedName, stageName } from "@/i18n/localize";
import { deletePenalty, proposePenalty, reviewPenalty, setRiderStatus } from "@/lib/admin/actions/penalties";
import { getEventRoles, requireViewer } from "@/lib/auth";
import { formatClock, formatDuration } from "@/lib/format";

type PenaltyType = {
  kind: string;
  seconds: number | null;
  unit_label: string | null;
  dsq_scope: string | null;
  fine_eur: number | null;
};

function describeType(type: PenaltyType, dict: Dictionary): string {
  const p = dict.admin.penalties;
  switch (type.kind) {
    case "time":
      return `+${formatDuration(type.seconds)}`;
    case "time_per_unit":
      return `+${formatDuration(type.seconds)} / ${type.unit_label}`;
    case "dsq":
      return t(p.dsq, { scope: p.dsqScope[type.dsq_scope as keyof typeof p.dsqScope] ?? "" });
    case "fine":
      return t(p.fine, { eur: type.fine_eur ?? 0 });
    default:
      return type.kind.toUpperCase();
  }
}

export default async function EventPenaltiesPage({ params }: PageProps<"/[lang]/admin/events/[eventId]/penalties">) {
  const { lang, eventId: rawId } = await params;
  const eventId = Number(rawId);
  if (!hasLocale(lang) || !Number.isInteger(eventId)) notFound();
  const dict = getDictionary(lang);
  const p = dict.admin.penalties;
  const viewer = await requireViewer(lang, `/${lang}/admin/events/${eventId}/penalties`);
  const { supabase } = viewer;

  const [roles, { data: stages }, { data: types }, { data: penalties }, { data: statuses }] = await Promise.all([
    getEventRoles(viewer, eventId),
    supabase.from("stages").select("id, name, name_en, type, day_number").eq("event_id", eventId).order("day_number").order("sort_order"),
    supabase
      .from("penalty_types")
      .select("id, code, name, name_en, kind, seconds, unit_label, dsq_scope, fine_eur")
      .or(`event_id.is.null,event_id.eq.${eventId}`)
      .eq("active", true)
      .order("id"),
    supabase
      .from("penalties")
      .select(
        "id, stage_id, units, seconds, note, evidence_url, status, created_at, penalty_types(name, name_en, kind, seconds, unit_label, dsq_scope, fine_eur), entries(race_number, riders(first_name, last_name))",
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
    supabase
      .from("rider_statuses")
      .select("id, stage_id, status, reason, entries(race_number, riders(first_name, last_name))")
      .eq("event_id", eventId)
      .is("session_id", null),
  ]);

  const canReview = viewer.isSuperAdmin || roles.has("jury") || roles.has("jury_chair");
  const labels = { day: dict.event.day, stageType: dict.stageType };
  const stageLabel = new Map((stages ?? []).map((stage) => [stage.id, stageName(stage, lang, labels)]));
  const stageOptions = (stages ?? []).map((stage) => ({ value: stage.id, label: stageName(stage, lang, labels) }));
  const statusTone: Record<string, string> = { proposed: "text-warn", confirmed: "text-good", rejected: "text-muted line-through" };

  return (
    <>
      <Card title={dict.admin.tabs.penalties}>
        {!penalties?.length && <p className="text-sm text-muted">{p.none}</p>}
        <ul className="divide-y divide-border text-sm">
          {(penalties ?? []).map((penalty) => (
            <li key={penalty.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="font-medium">
                  #{penalty.entries?.race_number} {penalty.entries?.riders?.first_name} {penalty.entries?.riders?.last_name}
                </div>
                <div className="text-xs text-muted">
                  {stageLabel.get(penalty.stage_id)} · {formatClock(penalty.created_at)}
                </div>
                <div className="mt-1">
                  {penalty.penalty_types ? localizedName(penalty.penalty_types, lang) : ""}
                  <span className="ml-2 font-mono text-xs">
                    {penalty.seconds != null
                      ? `+${formatDuration(penalty.seconds)}`
                      : penalty.penalty_types
                        ? describeType(penalty.penalty_types, dict)
                        : ""}
                  </span>
                </div>
                {penalty.note && <div className="text-xs text-muted">{penalty.note}</div>}
                {penalty.evidence_url && (
                  <a href={penalty.evidence_url} target="_blank" rel="noreferrer" className="text-xs text-accent underline">
                    {p.evidence}
                  </a>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`text-xs font-medium ${statusTone[penalty.status]}`}>
                  {p.review[penalty.status as keyof typeof p.review]}
                </span>
                {penalty.status === "proposed" && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {canReview && (
                      <>
                        <ActionButton action={reviewPenalty} fields={{ lang, penalty_id: penalty.id, status: "confirmed" }} label={p.confirm} pendingLabel="…" tone="good" />
                        <ActionButton action={reviewPenalty} fields={{ lang, penalty_id: penalty.id, status: "rejected" }} label={p.reject} pendingLabel="…" />
                      </>
                    )}
                    <ActionButton action={deletePenalty} fields={{ lang, penalty_id: penalty.id }} label={p.delete} pendingLabel="…" tone="bad" />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={p.propose}>
        <ActionForm action={proposePenalty} submitLabel={p.propose} pendingLabel={dict.common.loading}>
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="event_id" value={eventId} />
          <div className="grid gap-3 sm:grid-cols-4">
            <SelectField label={p.stage} name="stage_id" options={stageOptions} />
            <TextField label={p.raceNumber} name="race_number" type="number" min={1} required />
            <SelectField
              label={p.type}
              name="penalty_type_id"
              className="sm:col-span-2"
              options={(types ?? []).map((type) => ({
                value: type.id,
                label: `${localizedName(type, lang)} — ${describeType(type, dict)}`,
              }))}
            />
            <TextField label={p.units} name="units" type="number" min={0.1} step={0.1} defaultValue={1} />
            <TextField label={p.note} name="note" className="sm:col-span-3" />
            <TextField label={p.evidence} name="evidence_url" type="url" className="sm:col-span-4" />
          </div>
        </ActionForm>
      </Card>

      <Card title={p.riderStatus}>
        <ActionForm action={setRiderStatus} submitLabel={p.setStatus} pendingLabel={dict.common.loading}>
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="event_id" value={eventId} />
          <div className="grid gap-3 sm:grid-cols-4">
            <SelectField label={p.stage} name="stage_id" options={stageOptions} />
            <TextField label={p.raceNumber} name="race_number" type="number" min={1} required />
            <SelectField
              label={dict.admin.fields.status}
              name="status"
              options={[
                { value: "dns", label: "DNS" },
                { value: "dnf", label: "DNF" },
                { value: "dsq", label: "DSQ" },
                { value: "nc", label: dict.status.nc },
                { value: "", label: p.clear },
              ]}
            />
            <TextField label={p.reason} name="reason" />
          </div>
        </ActionForm>

        <h3 className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-muted">{p.statuses}</h3>
        {!statuses?.length && <p className="text-sm text-muted">{p.noStatuses}</p>}
        <ul className="divide-y divide-border text-sm">
          {(statuses ?? []).map((row) => (
            <li key={row.id} className="flex justify-between gap-2 py-1.5">
              <span>
                #{row.entries?.race_number} {row.entries?.riders?.first_name} {row.entries?.riders?.last_name}
                <span className="ml-2 text-xs text-muted">{stageLabel.get(row.stage_id)}</span>
              </span>
              <span className="text-xs">
                <span className="font-medium">{dict.status[row.status as keyof typeof dict.status] || row.status.toUpperCase()}</span>
                {row.reason && <span className="ml-2 text-muted">{row.reason}</span>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
