import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { Card, TextField } from "@/components/admin/fields";
import { StageFields } from "@/components/admin/stage-fields";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localizedName, stageName } from "@/i18n/localize";
import {
  addCheckpoint,
  createSessions,
  deleteCheckpoint,
  generateStartList,
  saveStageClasses,
  updateStage,
} from "@/lib/admin/actions/stages";
import { requireViewer } from "@/lib/auth";
import { formatClock } from "@/lib/format";
import { isoToEventLocal } from "@/lib/timezone";

export default async function StageDetailPage({ params }: PageProps<"/[lang]/admin/events/[eventId]/stages/[stageId]">) {
  const { lang, eventId: rawEventId, stageId: rawStageId } = await params;
  const eventId = Number(rawEventId);
  const stageId = Number(rawStageId);
  if (!hasLocale(lang) || !Number.isInteger(eventId) || !Number.isInteger(stageId)) notFound();
  const dict = getDictionary(lang);
  const s = dict.admin.stages;
  const viewer = await requireViewer(lang, `/${lang}/admin/events/${eventId}/stages/${stageId}`);
  const { supabase } = viewer;

  const [{ data: stage }, { data: scales }, { data: stageClasses }, { data: checkpoints }, { data: sessions }, { data: slots }] =
    await Promise.all([
      supabase
        .from("stages")
        .select("id, event_id, name, name_en, type, day_number, points_scale, first_start_at, start_interval_seconds, riders_per_slot, course_closes_at")
        .eq("id", stageId)
        .eq("event_id", eventId)
        .maybeSingle(),
      supabase.from("points_scales").select("code, name").order("code"),
      supabase
        .from("stage_classes")
        .select(
          "class_id, start_order, riders_per_slot, start_interval_seconds, gap_before_seconds, distance_km, course_closes_at, event_classes(classes(name, name_en))",
        )
        .eq("stage_id", stageId)
        .order("start_order"),
      supabase.from("checkpoints").select("id, code, name, name_en, sort_order").eq("stage_id", stageId).order("sort_order"),
      supabase
        .from("sessions")
        .select("id, class_id, kind, number, group_label, duration_minutes, started_at")
        .eq("stage_id", stageId)
        .order("class_id")
        .order("kind")
        .order("number"),
      supabase
        .from("start_slots")
        .select("position, scheduled_start, entries(race_number, class_id, riders(first_name, last_name))")
        .eq("stage_id", stageId)
        .order("position"),
    ]);
  if (!stage) notFound();

  const classNames = new Map(
    (stageClasses ?? []).map((row) => {
      const cls = row.event_classes?.classes;
      return [row.class_id, cls ? localizedName(cls, lang) : ""];
    }),
  );
  const small = "w-20 rounded border border-border bg-background px-2 py-1 text-right text-sm";
  const hidden = (
    <>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="stage_id" value={stageId} />
    </>
  );

  return (
    <>
      <Link href={`/${lang}/admin/events/${eventId}/stages`} className="mb-3 inline-block text-sm text-muted hover:text-foreground">
        ← {dict.admin.tabs.stages}
      </Link>
      <h2 className="mb-4 text-lg font-semibold">{stageName(stage, lang, { day: dict.event.day, stageType: dict.stageType })}</h2>

      <Card>
        <ActionForm action={updateStage} submitLabel={dict.admin.save} pendingLabel={dict.common.loading}>
          {hidden}
          <StageFields dict={dict} scales={scales ?? []} values={stage} />
        </ActionForm>
      </Card>

      <Card title={s.classSettings}>
        <ActionForm action={saveStageClasses} submitLabel={dict.admin.save} pendingLabel={dict.common.loading}>
          {hidden}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 pr-2 text-left font-medium">{dict.admin.entries.class}</th>
                  <th className="py-1 pr-2 text-right font-medium">{s.order}</th>
                  <th className="py-1 pr-2 text-right font-medium">{s.perSlot}</th>
                  <th className="py-1 pr-2 text-right font-medium">{s.interval}</th>
                  <th className="py-1 pr-2 text-right font-medium">{s.gapBefore}</th>
                  <th className="py-1 pr-2 text-right font-medium">{s.distance}</th>
                  <th className="py-1 text-right font-medium">{s.closesAt}</th>
                </tr>
              </thead>
              <tbody>
                {(stageClasses ?? []).map((row) => (
                  <tr key={row.class_id} className="border-t border-border">
                    <td className="py-2 pr-2">
                      <input type="hidden" name="class_id" value={row.class_id} />
                      {classNames.get(row.class_id)}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <input type="number" name={`start_order_${row.class_id}`} defaultValue={row.start_order} className={small} />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <input type="number" min={1} name={`riders_per_slot_${row.class_id}`} defaultValue={row.riders_per_slot ?? ""} placeholder={s.stageDefault} className={small} />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <input type="number" min={1} name={`interval_${row.class_id}`} defaultValue={row.start_interval_seconds ?? ""} placeholder={s.stageDefault} className={small} />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <input type="number" min={0} name={`gap_${row.class_id}`} defaultValue={row.gap_before_seconds} className={small} />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <input type="text" inputMode="decimal" name={`distance_${row.class_id}`} defaultValue={row.distance_km ?? ""} className={small} />
                    </td>
                    <td className="py-2 text-right">
                      <input
                        type="datetime-local"
                        name={`closes_${row.class_id}`}
                        defaultValue={isoToEventLocal(row.course_closes_at)}
                        className="rounded border border-border bg-background px-2 py-1 text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ActionForm>
      </Card>

      {stage.type === "navigation" && (
        <Card title={s.checkpoints}>
          <ul className="mb-3 divide-y divide-border text-sm">
            {(checkpoints ?? []).map((cp) => (
              <li key={cp.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-mono font-medium">{cp.code}</span> {localizedName(cp, lang)}
                </span>
                <ActionButton action={deleteCheckpoint} fields={{ lang, checkpoint_id: cp.id }} label={s.delete} pendingLabel="…" tone="bad" />
              </li>
            ))}
          </ul>
          <ActionForm action={addCheckpoint} submitLabel={s.addCheckpoint} pendingLabel={dict.common.loading}>
            {hidden}
            <div className="grid gap-3 sm:grid-cols-4">
              <TextField label={s.code} name="code" required placeholder="CP1" />
              <TextField label={dict.admin.fields.name} name="name" />
              <TextField label={dict.admin.fields.nameEn} name="name_en" />
              <TextField label={s.order} name="sort_order" type="number" defaultValue={(checkpoints?.length ?? 0) + 1} />
            </div>
          </ActionForm>
        </Card>
      )}

      {(stage.type === "enduro_cross" || stage.type === "prologue" || stage.type === "gncc") && (
        <Card title={s.sessions}>
          <ul className="mb-3 divide-y divide-border text-sm">
            {(sessions ?? []).map((session) => (
              <li key={session.id} className="flex justify-between gap-2 py-1.5">
                <span>
                  {classNames.get(session.class_id)} · {session.kind === "qualifying" ? "Q" : `H${session.number}`}
                  {session.group_label ? ` ${session.group_label}` : ""}
                </span>
                <span className="text-muted">
                  {session.duration_minutes} {s.duration}
                  {session.started_at && ` · ${formatClock(session.started_at)}`}
                </span>
              </li>
            ))}
          </ul>
          <ActionForm action={createSessions} submitLabel={s.createSessions} pendingLabel={dict.common.loading}>
            {hidden}
          </ActionForm>
        </Card>
      )}

      {stage.type === "navigation" && (
        <Card title={s.startList}>
          <ActionForm action={generateStartList} submitLabel={s.generate} pendingLabel={dict.common.loading}>
            {hidden}
          </ActionForm>
          {!slots?.length ? (
            <p className="mt-3 text-sm text-muted">{s.noStartList}</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-1 pr-2 text-right font-medium">#</th>
                    <th className="py-1 pr-2 text-left font-medium">{s.time}</th>
                    <th className="py-1 pr-2 text-right font-medium">{dict.admin.entries.raceNumber}</th>
                    <th className="py-1 pr-2 text-left font-medium">{dict.results.rider}</th>
                    <th className="py-1 text-left font-medium">{dict.admin.entries.class}</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot) => (
                    <tr key={slot.position} className="border-t border-border">
                      <td className="py-1.5 pr-2 text-right text-muted tabular-nums">{slot.position}</td>
                      <td className="py-1.5 pr-2 font-mono tabular-nums">{formatClock(slot.scheduled_start)}</td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{slot.entries?.race_number}</td>
                      <td className="py-1.5 pr-2">
                        {slot.entries?.riders?.first_name} {slot.entries?.riders?.last_name}
                      </td>
                      <td className="py-1.5">{slot.entries ? classNames.get(slot.entries.class_id) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
