import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { Card, CheckboxField, SelectField, TextAreaField, TextField } from "@/components/admin/fields";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { stageName } from "@/i18n/localize";
import { decideProtest, fileProtest } from "@/lib/admin/actions/protests";
import { getEventRoles, requireViewer } from "@/lib/auth";
import { formatClock } from "@/lib/format";

export default async function EventProtestsPage({ params }: PageProps<"/[lang]/admin/events/[eventId]/protests">) {
  const { lang, eventId: rawId } = await params;
  const eventId = Number(rawId);
  if (!hasLocale(lang) || !Number.isInteger(eventId)) notFound();
  const dict = getDictionary(lang);
  const text = dict.admin.protests;
  const viewer = await requireViewer(lang, `/${lang}/admin/events/${eventId}/protests`);
  const { supabase } = viewer;

  const [roles, { data: stages }, { data: entries }, { data: protests }] = await Promise.all([
    getEventRoles(viewer, eventId),
    supabase.from("stages").select("id, name, name_en, type, day_number").eq("event_id", eventId).order("day_number").order("sort_order"),
    supabase.from("entries").select("id, race_number, riders(first_name, last_name)").eq("event_id", eventId),
    supabase
      .from("protests")
      .select("id, stage_id, type, fact, fee_eur, fee_paid, fee_refunded, filed_at, deadline_at, status, decision, decided_at, filed_by_entry_id, against_entry_id")
      .eq("event_id", eventId)
      .order("filed_at", { ascending: false }),
  ]);

  const canDecide = viewer.isSuperAdmin || roles.has("jury") || roles.has("jury_chair");
  const labels = { day: dict.event.day, stageType: dict.stageType };
  const stageLabel = new Map((stages ?? []).map((stage) => [stage.id, stageName(stage, lang, labels)]));
  const entryLabel = new Map(
    (entries ?? []).map((entry) => [entry.id, `#${entry.race_number} ${entry.riders?.first_name ?? ""} ${entry.riders?.last_name ?? ""}`]),
  );
  const statusTone: Record<string, string> = { filed: "text-warn", upheld: "text-good", rejected: "text-muted", withdrawn: "text-muted" };

  return (
    <>
      <p className="mb-4 text-sm text-muted">{text.intro}</p>

      <Card title={dict.admin.tabs.protests}>
        {!protests?.length && <p className="text-sm text-muted">{text.none}</p>}
        <ul className="divide-y divide-border text-sm">
          {(protests ?? []).map((protest) => {
            const late = protest.deadline_at && protest.filed_at > protest.deadline_at;
            // The written decision is due within 24 hours of filing.
            const decisionDue = new Date(new Date(protest.filed_at).getTime() + 24 * 3_600_000).toISOString();
            return (
              <li key={protest.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {text.types[protest.type as keyof typeof text.types]}
                      {protest.stage_id && <span className="ml-2 text-xs text-muted">{stageLabel.get(protest.stage_id)}</span>}
                    </div>
                    <div className="text-xs text-muted">
                      {entryLabel.get(protest.filed_by_entry_id ?? 0)}
                      {protest.against_entry_id && ` → ${entryLabel.get(protest.against_entry_id)}`} ·{" "}
                      {t(text.filedAt, { time: formatClock(protest.filed_at) })}
                      {protest.deadline_at && ` · ${t(text.deadline, { time: formatClock(protest.deadline_at) })}`}
                      {protest.status === "filed" && ` · ${t(text.decisionDue, { time: formatClock(decisionDue) })}`}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className={`font-medium ${statusTone[protest.status]}`}>{text.status[protest.status as keyof typeof text.status]}</div>
                    {late && <div className="font-medium text-bad">{text.late}</div>}
                    <div className="text-muted">
                      {protest.fee_eur} € · {!protest.fee_paid ? text.feeNotPaid : protest.fee_refunded ? text.feeRefunded : ""}
                    </div>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-line">{protest.fact}</p>
                {protest.decision && (
                  <p className="mt-2 whitespace-pre-line rounded-md bg-background px-3 py-2 text-sm">
                    <span className="font-medium">{text.decision}:</span> {protest.decision}
                  </p>
                )}
                {canDecide && protest.status === "filed" && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {(["upheld", "rejected"] as const).map((status) => (
                      <ActionForm
                        key={status}
                        action={decideProtest}
                        submitLabel={status === "upheld" ? text.uphold : text.reject}
                        pendingLabel={dict.common.loading}
                      >
                        <input type="hidden" name="lang" value={lang} />
                        <input type="hidden" name="protest_id" value={protest.id} />
                        <input type="hidden" name="status" value={status} />
                        <TextAreaField label={text.decision} name="decision" required minLength={3} rows={2} />
                      </ActionForm>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title={text.file}>
        <ActionForm action={fileProtest} submitLabel={text.file} pendingLabel={dict.common.loading}>
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="event_id" value={eventId} />
          <div className="grid gap-3 sm:grid-cols-4">
            <SelectField
              label={text.type}
              name="type"
              options={Object.entries(text.types).map(([value, label]) => ({ value, label }))}
            />
            <SelectField
              label={text.stage}
              name="stage_id"
              options={[{ value: "", label: text.noStage }, ...(stages ?? []).map((stage) => ({ value: stage.id, label: stageLabel.get(stage.id) ?? "" }))]}
            />
            <TextField label={text.filedBy} name="filed_by" type="number" min={1} required />
            <TextField label={text.against} name="against" type="number" min={1} />
            <TextAreaField label={text.fact} name="fact" required minLength={5} className="sm:col-span-4" />
            <CheckboxField label={text.feePaid} name="fee_paid" className="sm:col-span-4" />
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
