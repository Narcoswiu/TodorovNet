"use server";

import { refresh } from "next/cache";
import { t } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { explainDbError, type ActionResult } from "@/lib/admin/action-result";
import { formContext, intField, isValidId, numberField, textField } from "@/lib/admin/form";
import { getViewer, type Viewer } from "@/lib/auth";

async function entryByNumber(viewer: Viewer, eventId: number, raceNumber: number) {
  const { data } = await viewer.supabase
    .from("entries")
    .select("id")
    .eq("event_id", eventId)
    .eq("race_number", raceNumber)
    .maybeSingle();
  return data?.id ?? null;
}

/** "12" for a whole stage, or "12:34" for heat 34 of enduro-cross stage 12. */
function stageAndSession(formData: FormData): { stageId: number | null; sessionId: number | null } {
  const [stage, session] = String(formData.get("stage_id") ?? "").split(":");
  const stageId = Number(stage);
  const sessionId = session ? Number(session) : null;
  return {
    stageId: Number.isInteger(stageId) && stageId > 0 ? stageId : null,
    sessionId: sessionId != null && Number.isInteger(sessionId) && sessionId > 0 ? sessionId : null,
  };
}

function juryError(error: { code?: string; message: string }, dict: Dictionary) {
  return error.message.includes("Only the jury") ? dict.admin.errors.forbidden : explainDbError(error, dict);
}

export async function proposePenalty(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const eventId = intField(formData, "event_id");
  const { stageId, sessionId } = stageAndSession(formData);
  const raceNumber = intField(formData, "race_number");
  const typeId = intField(formData, "penalty_type_id");
  const units = numberField(formData, "units") ?? 1;
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(eventId) || !isValidId(stageId) || !isValidId(raceNumber) || !isValidId(typeId) || !(units > 0)) {
    return { ok: false, error: dict.admin.errors.invalid };
  }

  const entryId = await entryByNumber(viewer, eventId, raceNumber);
  if (!entryId) return { ok: false, error: t(dict.admin.penalties.unknownNumber, { n: raceNumber }) };

  // An enduro-cross time penalty is added to one heat; without a heat it would count nowhere.
  if (!sessionId) {
    const [{ data: stage }, { data: type }] = await Promise.all([
      viewer.supabase.from("stages").select("type").eq("id", stageId).maybeSingle(),
      viewer.supabase.from("penalty_types").select("kind").eq("id", typeId).maybeSingle(),
    ]);
    if (stage?.type === "enduro_cross" && type && type.kind !== "dsq") {
      return { ok: false, error: dict.admin.penalties.chooseHeat };
    }
  }

  const { error } = await viewer.supabase.from("penalties").insert({
    event_id: eventId,
    stage_id: stageId,
    session_id: sessionId,
    entry_id: entryId,
    penalty_type_id: typeId,
    units,
    note: textField(formData, "note") || null,
    evidence_url: textField(formData, "evidence_url") || null,
  });
  if (error) return { ok: false, error: juryError(error, dict) };

  refresh();
  return { ok: true, message: dict.admin.saved };
}

export async function reviewPenalty(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const penaltyId = intField(formData, "penalty_id");
  const status = textField(formData, "status");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(penaltyId) || (status !== "confirmed" && status !== "rejected")) {
    return { ok: false, error: dict.admin.errors.invalid };
  }

  const { data, error } = await viewer.supabase.from("penalties").update({ status }).eq("id", penaltyId).select("id");
  if (error) return { ok: false, error: juryError(error, dict) };
  if (!data?.length) return { ok: false, error: dict.admin.errors.forbidden };

  refresh();
  return { ok: true };
}

export async function deletePenalty(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const penaltyId = intField(formData, "penalty_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(penaltyId)) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase.from("penalties").delete().eq("id", penaltyId).select("id");
  if (error) return { ok: false, error: explainDbError(error, dict) };
  if (!data?.length) return { ok: false, error: dict.admin.errors.forbidden };

  refresh();
  return { ok: true };
}

/** DNS / DNF / DSQ / NC set by an official for one stage. An empty status clears it. */
export async function setRiderStatus(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const eventId = intField(formData, "event_id");
  const { stageId, sessionId } = stageAndSession(formData);
  const raceNumber = intField(formData, "race_number");
  const status = textField(formData, "status");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(eventId) || !isValidId(stageId) || !isValidId(raceNumber) || !["", "dns", "dnf", "dsq", "nc"].includes(status)) {
    return { ok: false, error: dict.admin.errors.invalid };
  }

  const entryId = await entryByNumber(viewer, eventId, raceNumber);
  if (!entryId) return { ok: false, error: t(dict.admin.penalties.unknownNumber, { n: raceNumber }) };

  const { error } = status
    ? await viewer.supabase.from("rider_statuses").upsert(
        {
          event_id: eventId,
          stage_id: stageId,
          session_id: sessionId,
          entry_id: entryId,
          status: status as "dns" | "dnf" | "dsq" | "nc",
          reason: textField(formData, "reason") || null,
        },
        { onConflict: "stage_id,session_id,entry_id" },
      )
    : await viewer.supabase
        .from("rider_statuses")
        .delete()
        .eq("stage_id", stageId)
        .eq("entry_id", entryId)
        .filter("session_id", sessionId ? "eq" : "is", sessionId ?? null);
  if (error) return { ok: false, error: explainDbError(error, dict) };

  refresh();
  return { ok: true, message: dict.admin.saved };
}
