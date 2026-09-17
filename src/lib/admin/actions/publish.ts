"use server";

import { refresh } from "next/cache";
import { t } from "@/i18n/config";
import { explainDbError, type ActionResult } from "@/lib/admin/action-result";
import { formContext, intField, isValidId, textField } from "@/lib/admin/form";
import { getViewer } from "@/lib/auth";

/** Freezes the current classification of a stage (or the round final) as a new numbered version. */
export async function publishResults(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const eventId = intField(formData, "event_id");
  const stageRaw = textField(formData, "stage_id");
  const stageId = stageRaw === "round" ? null : intField(formData, "stage_id");
  const state = textField(formData, "state");
  const minutes = intField(formData, "protest_minutes");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (
    !isValidId(eventId) ||
    (stageId !== null && !isValidId(stageId)) ||
    (state !== "provisional" && state !== "official") ||
    (minutes !== null && (Number.isNaN(minutes) || minutes < 0))
  ) {
    return { ok: false, error: dict.admin.errors.invalid };
  }

  const { data: publicationId, error } = await viewer.supabase.rpc("publish_results", {
    p_event_id: eventId,
    // The function takes null for the round final; the generated type does not know that.
    p_stage_id: stageId as number,
    p_state: state,
    p_protest_minutes: minutes ?? undefined,
    p_note: textField(formData, "note") || undefined,
  });
  if (error) {
    if (error.message.includes("jury chair")) return { ok: false, error: dict.admin.publish.onlyChair };
    if (error.message.includes("not supported")) return { ok: false, error: dict.admin.publish.unsupported };
    return { ok: false, error: explainDbError(error, dict) };
  }

  const { data: publication } = await viewer.supabase.from("publications").select("version").eq("id", publicationId).single();

  refresh();
  return { ok: true, message: t(dict.admin.publish.published, { version: publication?.version ?? "?" }) };
}
