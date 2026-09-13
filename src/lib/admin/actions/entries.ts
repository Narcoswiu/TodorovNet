"use server";

import { refresh } from "next/cache";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { explainDbError, type ActionResult } from "@/lib/admin/action-result";
import { formContext, intField, isValidId, textField } from "@/lib/admin/form";
import type { ImportReport, ImportRow } from "@/lib/admin/spreadsheet";
import { getViewer } from "@/lib/auth";

/** One entry typed by hand. Uses the same database import as spreadsheets, so matching rules are identical. */
export async function addEntry(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const eventId = intField(formData, "event_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(eventId)) return { ok: false, error: dict.admin.errors.invalid };

  const row: ImportRow = {
    race_number: textField(formData, "race_number"),
    first_name: textField(formData, "first_name"),
    last_name: textField(formData, "last_name"),
    class: textField(formData, "class"),
    club: textField(formData, "club"),
    country: textField(formData, "country"),
    birth_date: textField(formData, "birth_date"),
    phone: textField(formData, "phone"),
    email: textField(formData, "email"),
    license_number: textField(formData, "license_number"),
  };

  const { data, error } = await viewer.supabase.rpc("import_entries", { p_event_id: eventId, p_rows: [row] });
  if (error) return { ok: false, error: explainDbError(error, dict) };
  const report = data as unknown as ImportReport;
  if (report.errors.length) return { ok: false, error: report.errors[0].message };

  refresh();
  return { ok: true, message: dict.admin.saved };
}

export async function importEntries(
  lang: string,
  eventId: number,
  rows: ImportRow[],
): Promise<{ ok: true; report: ImportReport } | { ok: false; error: string }> {
  const dict = getDictionary(hasLocale(lang) ? lang : defaultLocale);
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(eventId) || !Array.isArray(rows) || rows.length > 2000) {
    return { ok: false, error: dict.admin.errors.invalid };
  }

  const { data, error } = await viewer.supabase.rpc("import_entries", { p_event_id: eventId, p_rows: rows });
  if (error) return { ok: false, error: explainDbError(error, dict) };

  refresh();
  return { ok: true, report: data as unknown as ImportReport };
}

export async function setWithdrawn(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const entryId = intField(formData, "entry_id");
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(entryId)) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase
    .from("entries")
    .update({ withdrawn: textField(formData, "withdrawn") === "true" })
    .eq("id", entryId)
    .select("id");
  if (error) return { ok: false, error: explainDbError(error, dict) };
  if (!data?.length) return { ok: false, error: dict.admin.errors.forbidden };

  refresh();
  return { ok: true };
}
