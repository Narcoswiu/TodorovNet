"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { t } from "@/i18n/config";
import { explainDbError, type ActionResult } from "@/lib/admin/action-result";
import { formContext, intField, isValidId, numberField, textField } from "@/lib/admin/form";
import { getViewer } from "@/lib/auth";
import { eventLocalToIso } from "@/lib/timezone";

const STAGE_TYPES = ["prologue", "navigation", "enduro_cross", "gncc"] as const;
type StageType = (typeof STAGE_TYPES)[number];

function readStage(formData: FormData) {
  const type = textField(formData, "type") as StageType;
  const values = {
    day_number: intField(formData, "day_number"),
    type,
    name: textField(formData, "name"),
    name_en: textField(formData, "name_en") || null,
    points_scale: textField(formData, "points_scale") || null,
    first_start_at: eventLocalToIso(textField(formData, "first_start_at")),
    start_interval_seconds: intField(formData, "start_interval_seconds"),
    riders_per_slot: intField(formData, "riders_per_slot") ?? 1,
    course_closes_at: eventLocalToIso(textField(formData, "course_closes_at")),
  };
  const valid =
    isValidId(values.day_number) &&
    STAGE_TYPES.includes(type) &&
    values.name.length > 0 &&
    !Number.isNaN(values.start_interval_seconds) &&
    isValidId(values.riders_per_slot);
  return valid ? { ...values, day_number: values.day_number as number } : null;
}

export async function createStage(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { lang, dict } = formContext(formData);
  const viewer = await getViewer();
  const eventId = intField(formData, "event_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  const stage = readStage(formData);
  if (!isValidId(eventId) || !stage) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase
    .from("stages")
    .insert({ ...stage, event_id: eventId })
    .select("id")
    .single();
  if (error) return { ok: false, error: explainDbError(error, dict) };

  // Every class of the event races the new stage by default, in the event's start order.
  const { data: classes } = await viewer.supabase.from("event_classes").select("class_id, start_order").eq("event_id", eventId);
  if (classes?.length) {
    await viewer.supabase.from("stage_classes").insert(
      classes.map((c) => ({ stage_id: data.id, event_id: eventId, class_id: c.class_id, start_order: c.start_order })),
    );
  }

  redirect(`/${lang}/admin/events/${eventId}/stages/${data.id}`);
}

export async function updateStage(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const stageId = intField(formData, "stage_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  const stage = readStage(formData);
  if (!isValidId(stageId) || !stage) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase.from("stages").update(stage).eq("id", stageId).select("id");
  if (error) return { ok: false, error: explainDbError(error, dict) };
  if (!data?.length) return { ok: false, error: dict.admin.errors.forbidden };

  refresh();
  return { ok: true, message: dict.admin.saved };
}

export async function saveStageClasses(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const stageId = intField(formData, "stage_id");
  const eventId = intField(formData, "event_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(stageId) || !isValidId(eventId)) return { ok: false, error: dict.admin.errors.invalid };

  const rows = formData
    .getAll("class_id")
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)
    .map((classId) => ({
      stage_id: stageId,
      event_id: eventId,
      class_id: classId,
      start_order: intField(formData, `start_order_${classId}`) ?? 0,
      riders_per_slot: intField(formData, `riders_per_slot_${classId}`),
      start_interval_seconds: intField(formData, `interval_${classId}`),
      gap_before_seconds: intField(formData, `gap_${classId}`) ?? 0,
      distance_km: numberField(formData, `distance_${classId}`),
      course_closes_at: eventLocalToIso(textField(formData, `closes_${classId}`)),
    }));

  const invalid = rows.some((row) =>
    [row.start_order, row.riders_per_slot, row.start_interval_seconds, row.gap_before_seconds, row.distance_km].some(
      (value) => Number.isNaN(value),
    ),
  );
  if (invalid) return { ok: false, error: dict.admin.errors.invalid };

  const { error } = await viewer.supabase.from("stage_classes").upsert(rows, { onConflict: "stage_id,class_id" });
  if (error) return { ok: false, error: explainDbError(error, dict) };

  refresh();
  return { ok: true, message: dict.admin.saved };
}

export async function addCheckpoint(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const stageId = intField(formData, "stage_id");
  const eventId = intField(formData, "event_id");
  const code = textField(formData, "code").toUpperCase();
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(stageId) || !isValidId(eventId) || !code) return { ok: false, error: dict.admin.errors.invalid };

  const { error } = await viewer.supabase.from("checkpoints").insert({
    stage_id: stageId,
    event_id: eventId,
    code,
    name: textField(formData, "name"),
    name_en: textField(formData, "name_en") || null,
    sort_order: intField(formData, "sort_order") ?? 0,
  });
  if (error) return { ok: false, error: explainDbError(error, dict) };

  refresh();
  return { ok: true, message: dict.admin.saved };
}

export async function deleteCheckpoint(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const checkpointId = intField(formData, "checkpoint_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(checkpointId)) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase.from("checkpoints").delete().eq("id", checkpointId).select("id");
  if (error) return { ok: false, error: explainDbError(error, dict) };
  if (!data?.length) return { ok: false, error: dict.admin.errors.forbidden };

  refresh();
  return { ok: true };
}

/** Qualifying plus two heats for every class of the stage, with the rulebook's recommended heat lengths. */
export async function createSessions(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const stageId = intField(formData, "stage_id");
  const eventId = intField(formData, "event_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(stageId) || !isValidId(eventId)) return { ok: false, error: dict.admin.errors.invalid };

  const { data: classes, error: classesError } = await viewer.supabase
    .from("stage_classes")
    .select("class_id, event_classes(classes(code))")
    .eq("stage_id", stageId);
  if (classesError) return { ok: false, error: explainDbError(classesError, dict) };

  // Р XVI p.12: Pro 10 min + 1 lap, Expert and Senior 40+ 8 min + 1 lap, the rest 7 min + 1 lap.
  const heatMinutes = (code: string) => (code === "pro" ? 10 : code === "exp" || code === "s40" ? 8 : 7);
  const rows = (classes ?? []).flatMap((c) => {
    const code = c.event_classes?.classes?.code ?? "";
    return [
      { kind: "qualifying" as const, number: 1, duration_minutes: 20 },
      { kind: "heat" as const, number: 1, duration_minutes: heatMinutes(code) },
      { kind: "heat" as const, number: 2, duration_minutes: heatMinutes(code) },
    ].map((session) => ({ ...session, stage_id: stageId, event_id: eventId, class_id: c.class_id, extra_laps: 1 }));
  });

  const { error } = await viewer.supabase
    .from("sessions")
    .upsert(rows, { onConflict: "stage_id,class_id,kind,group_label,number", ignoreDuplicates: true });
  if (error) return { ok: false, error: explainDbError(error, dict) };

  refresh();
  return { ok: true, message: dict.admin.stages.sessionsCreated };
}

export async function generateStartList(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const stageId = intField(formData, "stage_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(stageId)) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase.rpc("generate_start_list", { p_stage_id: stageId });
  if (error) {
    if (error.message.includes("first start time")) return { ok: false, error: dict.admin.stages.needFirstStart };
    if (error.message.includes("locked")) return { ok: false, error: dict.admin.stages.locked };
    if (error.message.includes("Only the organizer")) return { ok: false, error: dict.admin.errors.forbidden };
    return { ok: false, error: explainDbError(error, dict) };
  }

  refresh();
  return { ok: true, message: t(dict.admin.stages.generated, { n: data }) };
}
