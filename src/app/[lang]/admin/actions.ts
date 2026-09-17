"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { explainDbError, type ActionResult } from "@/lib/admin/action-result";
import { formContext, intField, isValidId } from "@/lib/admin/form";
import { getViewer } from "@/lib/auth";

// Every action re-checks the session; the database (RLS) then decides whether this user may do it.

const optionalInt = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const eventFields = z.object({
  name: z.string().trim().min(2),
  location: z.string().trim(),
  date_from: z.iso.date(),
  date_to: z.iso.date(),
  kind: z.enum(["championship_round", "free"]),
  season_id: optionalInt,
  round_number: optionalInt,
  status: z.enum(["draft", "upcoming", "live", "finished"]),
  ranking: z.enum(["points", "time"]),
});

export async function createEvent(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { lang, dict } = formContext(formData);
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };

  const parsed = eventFields.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase
    .from("events")
    .insert({
      ...parsed.data,
      season_id: parsed.data.season_id ?? null,
      round_number: parsed.data.round_number ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: explainDbError(error, dict) };

  redirect(`/${lang}/admin/events/${data.id}/classes`);
}

export async function updateEvent(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };

  const eventId = intField(formData, "event_id");
  const parsed = eventFields.safeParse(Object.fromEntries(formData));
  if (!isValidId(eventId) || !parsed.success) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase
    .from("events")
    .update({
      ...parsed.data,
      season_id: parsed.data.season_id ?? null,
      round_number: parsed.data.round_number ?? null,
    })
    .eq("id", eventId)
    .select("id");
  if (error) return { ok: false, error: explainDbError(error, dict) };
  // RLS hides rows the user may not update: zero rows means no permission, not success.
  if (!data?.length) return { ok: false, error: dict.admin.errors.forbidden };

  refresh();
  return { ok: true, message: dict.admin.saved };
}

export async function signOut(formData: FormData) {
  const { lang } = formContext(formData);
  const viewer = await getViewer();
  await viewer?.supabase.auth.signOut();
  redirect(`/${lang}`);
}
