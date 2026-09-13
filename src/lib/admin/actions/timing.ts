"use server";

import { refresh } from "next/cache";
import { t } from "@/i18n/config";
import { explainDbError, type ActionResult } from "@/lib/admin/action-result";
import { formContext, intField, isValidId, numberField, textField } from "@/lib/admin/form";
import { getViewer, type Viewer } from "@/lib/auth";
import { eventLocalToIso } from "@/lib/timezone";

async function entryIdByNumber(viewer: Viewer, eventId: number, raceNumber: number) {
  const { data } = await viewer.supabase
    .from("entries")
    .select("id")
    .eq("event_id", eventId)
    .eq("race_number", raceNumber)
    .maybeSingle();
  return data?.id ?? null;
}

/** A time copied from a paper sheet or another clock. Same uniqueness rules as the phone app. */
export async function addManualPassing(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const eventId = intField(formData, "event_id");
  const stageId = intField(formData, "stage_id");
  const raceNumber = intField(formData, "race_number");
  const point = textField(formData, "point");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(eventId) || !isValidId(stageId) || !isValidId(raceNumber)) {
    return { ok: false, error: dict.admin.errors.invalid };
  }

  const passedAt = eventLocalToIso(`${textField(formData, "date")}T${textField(formData, "time")}`);
  if (!passedAt) return { ok: false, error: dict.admin.timing.invalidTime };

  const isCheckpoint = point.startsWith("cp:");
  if (!isCheckpoint && point !== "start" && point !== "finish") return { ok: false, error: dict.admin.errors.invalid };

  const entryId = await entryIdByNumber(viewer, eventId, raceNumber);
  if (!entryId) return { ok: false, error: t(dict.admin.timing.unknownNumber, { n: raceNumber }) };

  const { error } = await viewer.supabase.from("passings").insert({
    client_id: crypto.randomUUID(),
    event_id: eventId,
    stage_id: stageId,
    entry_id: entryId,
    point: isCheckpoint ? "checkpoint" : (point as "start" | "finish"),
    checkpoint_id: isCheckpoint ? Number(point.slice(3)) : null,
    passed_at: passedAt,
    source: "manual",
  });
  if (error) {
    if (error.message.includes("one_active")) return { ok: false, error: dict.timing.rejected + ": " + dict.admin.errors.duplicate };
    return { ok: false, error: explainDbError(error, dict) };
  }

  refresh();
  return { ok: true, message: dict.admin.saved };
}

/** Voids a record. It stays in the list and the audit log; results ignore it. */
export async function voidPassing(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const passingId = intField(formData, "passing_id");
  const reason = textField(formData, "reason");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(passingId) || !reason) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase
    .from("passings")
    .update({ voided_at: new Date().toISOString(), void_reason: reason, voided_by: viewer.userId })
    .eq("id", passingId)
    .is("voided_at", null)
    .select("id");
  if (error) return { ok: false, error: explainDbError(error, dict) };
  if (!data?.length) return { ok: false, error: dict.admin.errors.forbidden };

  refresh();
  return { ok: true };
}

export async function addTimeAdjustment(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const eventId = intField(formData, "event_id");
  const stageId = intField(formData, "stage_id");
  const minutes = numberField(formData, "minutes");
  const reason = textField(formData, "reason");
  const scope = textField(formData, "scope");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(eventId) || !isValidId(stageId) || minutes == null || Number.isNaN(minutes) || minutes === 0 || !reason) {
    return { ok: false, error: dict.admin.errors.invalid };
  }

  let entryId: number | null = null;
  let classId: number | null = null;
  if (scope === "class") {
    classId = intField(formData, "class_id");
    if (!isValidId(classId)) return { ok: false, error: dict.admin.errors.invalid };
  } else {
    const raceNumber = intField(formData, "race_number");
    if (!isValidId(raceNumber)) return { ok: false, error: dict.admin.errors.invalid };
    entryId = await entryIdByNumber(viewer, eventId, raceNumber);
    if (!entryId) return { ok: false, error: t(dict.admin.timing.unknownNumber, { n: raceNumber }) };
  }

  const { error } = await viewer.supabase.from("time_adjustments").insert({
    event_id: eventId,
    stage_id: stageId,
    entry_id: entryId,
    class_id: classId,
    seconds: Math.round(minutes * 60 * 1000) / 1000,
    reason,
  });
  if (error) return { ok: false, error: explainDbError(error, dict) };

  refresh();
  return { ok: true, message: dict.admin.saved };
}

export async function deleteTimeAdjustment(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const adjustmentId = intField(formData, "adjustment_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(adjustmentId)) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase.from("time_adjustments").delete().eq("id", adjustmentId).select("id");
  if (error) return { ok: false, error: explainDbError(error, dict) };
  if (!data?.length) return { ok: false, error: dict.admin.errors.forbidden };

  refresh();
  return { ok: true };
}
