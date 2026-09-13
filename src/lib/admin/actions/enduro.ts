"use server";

import { refresh } from "next/cache";
import { t } from "@/i18n/config";
import { explainDbError, type ActionResult } from "@/lib/admin/action-result";
import { formContext, intField, isValidId } from "@/lib/admin/form";
import { getViewer } from "@/lib/auth";

export async function buildQualifyingGroups(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const stageId = intField(formData, "stage_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(stageId)) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase.rpc("build_qualifying_groups", { p_stage_id: stageId });
  if (error) return { ok: false, error: explainDbError(error, dict) };

  refresh();
  return { ok: true, message: t(dict.admin.stages.groupsBuilt, { n: data }) };
}

export async function buildFinalsGrid(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const stageId = intField(formData, "stage_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(stageId)) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase.rpc("build_finals_grid", { p_stage_id: stageId });
  if (error) return { ok: false, error: explainDbError(error, dict) };

  refresh();
  return { ok: true, message: t(dict.admin.stages.gridBuilt, { n: data }) };
}

/** Stops the clock on the heat: the decision (count or restart) follows separately. */
export async function redFlagNow(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const sessionId = intField(formData, "session_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(sessionId)) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase
    .from("sessions")
    .update({ red_flag_at: new Date().toISOString(), red_flag_decision: null })
    .eq("id", sessionId)
    .not("started_at", "is", null)
    .select("id");
  if (error) return { ok: false, error: explainDbError(error, dict) };
  if (!data?.length) return { ok: false, error: dict.admin.errors.forbidden };

  refresh();
  return { ok: true };
}

/** More than half the heat was run (Р XVI): keep it, classified at the moment of the flag. */
export async function countAtRedFlag(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const sessionId = intField(formData, "session_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(sessionId)) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase
    .from("sessions")
    .update({ red_flag_decision: "count" })
    .eq("id", sessionId)
    .not("red_flag_at", "is", null)
    .select("id");
  if (error) return { ok: false, error: explainDbError(error, dict) };
  if (!data?.length) return { ok: false, error: dict.admin.errors.forbidden };

  refresh();
  return { ok: true };
}

export async function restartHeat(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const sessionId = intField(formData, "session_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(sessionId)) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase.rpc("restart_session", { p_session_id: sessionId });
  if (error) return { ok: false, error: explainDbError(error, dict) };

  refresh();
  return { ok: true, message: t(dict.admin.stages.restarted, { n: data }) };
}
