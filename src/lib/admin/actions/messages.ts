"use server";

import { refresh } from "next/cache";
import { explainDbError, type ActionResult } from "@/lib/admin/action-result";
import { formContext, intField, isValidId } from "@/lib/admin/form";
import { getViewer } from "@/lib/auth";

export async function resolveMessage(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const messageId = intField(formData, "message_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(messageId)) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase
    .from("marshal_messages")
    .update({ resolved_at: new Date().toISOString(), resolved_by: viewer.userId })
    .eq("id", messageId)
    .is("resolved_at", null)
    .select("id");
  if (error) return { ok: false, error: explainDbError(error, dict) };
  if (!data?.length) return { ok: false, error: dict.admin.errors.forbidden };

  refresh();
  return { ok: true };
}
