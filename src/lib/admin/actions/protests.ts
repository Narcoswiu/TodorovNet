"use server";

import { refresh } from "next/cache";
import { t } from "@/i18n/config";
import { explainDbError, type ActionResult } from "@/lib/admin/action-result";
import { formContext, intField, isValidId, textField } from "@/lib/admin/form";
import { getViewer, type Viewer } from "@/lib/auth";
import { formatClock } from "@/lib/format";

type ProtestType = "incident" | "result" | "navigation" | "eligibility" | "technical";
const TYPES: ProtestType[] = ["incident", "result", "navigation", "eligibility", "technical"];

// Р XX: 2 h after navigation results and penalised tracks are published, 30 min for results,
// technical matters and course incidents. Eligibility is decided before the race day.
const WINDOW_MINUTES: Record<ProtestType, number | null> = {
  navigation: 120,
  result: 30,
  technical: 30,
  incident: 30,
  eligibility: null,
};

async function entryIdByNumber(viewer: Viewer, eventId: number, raceNumber: number) {
  const { data } = await viewer.supabase
    .from("entries")
    .select("id")
    .eq("event_id", eventId)
    .eq("race_number", raceNumber)
    .maybeSingle();
  return data?.id ?? null;
}

export async function fileProtest(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const text = dict.admin.protests;
  const viewer = await getViewer();
  const eventId = intField(formData, "event_id");
  const stageId = intField(formData, "stage_id");
  const filedBy = intField(formData, "filed_by");
  const against = intField(formData, "against");
  const type = textField(formData, "type") as ProtestType;
  const fact = textField(formData, "fact");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (
    !isValidId(eventId) ||
    (stageId !== null && !isValidId(stageId)) ||
    !isValidId(filedBy) ||
    (against !== null && !isValidId(against)) ||
    !TYPES.includes(type) ||
    fact.length < 5
  ) {
    return { ok: false, error: dict.admin.errors.invalid };
  }

  const filedByEntry = await entryIdByNumber(viewer, eventId, filedBy);
  if (!filedByEntry) return { ok: false, error: t(text.unknownNumber, { n: filedBy }) };
  const againstEntry = against ? await entryIdByNumber(viewer, eventId, against) : null;
  if (against && !againstEntry) return { ok: false, error: t(text.unknownNumber, { n: against }) };

  // The window runs from the latest publication of the stage (or of the round final without a stage).
  let deadline: string | null = null;
  const window = WINDOW_MINUTES[type];
  if (window != null) {
    let query = viewer.supabase.from("publications").select("published_at").eq("event_id", eventId);
    query = stageId ? query.eq("stage_id", stageId) : query.is("stage_id", null);
    const { data: latest } = await query.order("published_at", { ascending: false }).limit(1).maybeSingle();
    if (latest) deadline = new Date(new Date(latest.published_at).getTime() + window * 60_000).toISOString();
  }

  const { data: protest, error } = await viewer.supabase
    .from("protests")
    .insert({
      event_id: eventId,
      stage_id: stageId,
      filed_by_entry_id: filedByEntry,
      against_entry_id: againstEntry,
      type,
      fact,
      fee_paid: textField(formData, "fee_paid") === "true",
      deadline_at: deadline,
    })
    .select("filed_at, deadline_at")
    .single();
  if (error) return { ok: false, error: explainDbError(error, dict) };

  refresh();
  const late = protest.deadline_at && protest.filed_at > protest.deadline_at;
  return late
    ? { ok: true, message: t(text.filedLate, { time: formatClock(protest.deadline_at) }) }
    : { ok: true, message: text.filedOk };
}

export async function decideProtest(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const protestId = intField(formData, "protest_id");
  const status = textField(formData, "status");
  const decision = textField(formData, "decision");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(protestId) || (status !== "upheld" && status !== "rejected") || decision.length < 3) {
    return { ok: false, error: dict.admin.errors.invalid };
  }

  const { data: current } = await viewer.supabase.from("protests").select("fee_paid").eq("id", protestId).maybeSingle();
  if (!current) return { ok: false, error: dict.admin.errors.forbidden };

  const { data, error } = await viewer.supabase
    .from("protests")
    .update({
      status,
      decision,
      decided_by: viewer.userId,
      decided_at: new Date().toISOString(),
      // Р XX: the fee is refunded when the protest is upheld.
      fee_refunded: status === "upheld" && current.fee_paid,
    })
    .eq("id", protestId)
    .eq("status", "filed")
    .select("id");
  if (error) return { ok: false, error: explainDbError(error, dict) };
  if (!data?.length) return { ok: false, error: dict.admin.errors.forbidden };

  refresh();
  return { ok: true, message: dict.admin.saved };
}
