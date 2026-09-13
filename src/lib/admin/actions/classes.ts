"use server";

import { refresh } from "next/cache";
import { explainDbError, type ActionResult } from "@/lib/admin/action-result";
import { formContext, intField, isValidId } from "@/lib/admin/form";
import { getViewer } from "@/lib/auth";

/** Sets which classes race in the event and their start order. Unticked classes are removed. */
export async function saveEventClasses(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const eventId = intField(formData, "event_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(eventId)) return { ok: false, error: dict.admin.errors.invalid };

  const selected = formData.getAll("class_id").map(Number).filter((id) => Number.isInteger(id) && id > 0);
  const rows = selected.map((classId) => ({
    event_id: eventId,
    class_id: classId,
    start_order: intField(formData, `order_${classId}`) ?? 0,
  }));
  if (rows.some((row) => Number.isNaN(row.start_order))) return { ok: false, error: dict.admin.errors.invalid };

  if (rows.length) {
    const { error } = await viewer.supabase.from("event_classes").upsert(rows, { onConflict: "event_id,class_id" });
    if (error) return { ok: false, error: explainDbError(error, dict) };
  }

  let removal = viewer.supabase.from("event_classes").delete().eq("event_id", eventId);
  if (selected.length) removal = removal.not("class_id", "in", `(${selected.join(",")})`);
  const { error: removalError } = await removal;
  if (removalError) return { ok: false, error: explainDbError(removalError, dict) };

  refresh();
  return { ok: true, message: dict.admin.saved };
}
