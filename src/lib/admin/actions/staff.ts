"use server";

import { refresh } from "next/cache";
import { explainDbError, type ActionResult } from "@/lib/admin/action-result";
import { formContext, intField, isValidId, textField } from "@/lib/admin/form";
import { getViewer, type StaffRole } from "@/lib/auth";

const ROLES: StaffRole[] = ["organizer", "timekeeper", "gps_judge", "jury", "jury_chair"];

export async function assignStaff(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const eventId = intField(formData, "event_id");
  const email = textField(formData, "email");
  const role = textField(formData, "role") as StaffRole;
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(eventId) || !email.includes("@") || !ROLES.includes(role)) {
    return { ok: false, error: dict.admin.errors.invalid };
  }

  const { error } = await viewer.supabase.rpc("assign_staff", { p_event_id: eventId, p_email: email, p_role: role });
  if (error) {
    if (error.code === "P0002") return { ok: false, error: dict.admin.staff.notFound };
    return { ok: false, error: explainDbError(error, dict) };
  }

  refresh();
  return { ok: true, message: dict.admin.saved };
}

export async function removeStaff(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const eventId = intField(formData, "event_id");
  const userId = textField(formData, "user_id");
  const role = textField(formData, "role") as StaffRole;
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(eventId) || !userId || !ROLES.includes(role)) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase
    .from("event_staff")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("role", role)
    .select("role");
  if (error) return { ok: false, error: explainDbError(error, dict) };
  if (!data?.length) return { ok: false, error: dict.admin.errors.forbidden };

  refresh();
  return { ok: true };
}
