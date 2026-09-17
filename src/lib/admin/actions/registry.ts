"use server";

import { refresh } from "next/cache";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { explainDbError, type ActionResult } from "@/lib/admin/action-result";
import { formContext, intField, isValidId, textField } from "@/lib/admin/form";
import type { ImportReport, ImportRow } from "@/lib/admin/spreadsheet";
import { getViewer } from "@/lib/auth";

export async function importSeasonNumbers(
  lang: string,
  seasonId: number,
  rows: ImportRow[],
): Promise<{ ok: true; report: ImportReport } | { ok: false; error: string }> {
  const dict = getDictionary(hasLocale(lang) ? lang : defaultLocale);
  const viewer = await getViewer();
  if (!viewer?.isSuperAdmin) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(seasonId) || !Array.isArray(rows) || rows.length > 3000) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase.rpc("import_season_numbers", { p_season_id: seasonId, p_rows: rows });
  if (error) return { ok: false, error: explainDbError(error, dict) };

  refresh();
  return { ok: true, report: data as unknown as ImportReport };
}

export async function registerSeasonNumber(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { lang, dict } = formContext(formData);
  const seasonId = intField(formData, "season_id");
  if (!isValidId(seasonId)) return { ok: false, error: dict.admin.errors.invalid };
  const result = await importSeasonNumbers(lang, seasonId, [
    {
      race_number: textField(formData, "race_number"),
      first_name: textField(formData, "first_name"),
      last_name: textField(formData, "last_name"),
      class: textField(formData, "class"),
      club: textField(formData, "club"),
      country: textField(formData, "country"),
      birth_date: "",
      phone: "",
      email: "",
      license_number: "",
    },
  ]);
  if (!result.ok) return result;
  if (result.report.errors.length) return { ok: false, error: result.report.errors[0].message };
  return { ok: true, message: dict.admin.saved };
}

export async function releaseSeasonNumber(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const seasonId = intField(formData, "season_id");
  const raceNumber = intField(formData, "race_number");
  if (!viewer?.isSuperAdmin) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(seasonId) || !isValidId(raceNumber)) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase
    .from("season_numbers")
    .delete()
    .eq("season_id", seasonId)
    .eq("race_number", raceNumber)
    .select("race_number");
  if (error) return { ok: false, error: explainDbError(error, dict) };
  if (!data?.length) return { ok: false, error: dict.admin.errors.forbidden };

  refresh();
  return { ok: true };
}

/** Marks a season final: from then on its standings drop the worst round (Р XVIII.3). Reversible. */
export async function setSeasonFinal(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { dict } = formContext(formData);
  const viewer = await getViewer();
  const seasonId = intField(formData, "season_id");
  const final = textField(formData, "final") === "true";
  if (!viewer?.isSuperAdmin) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(seasonId)) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase.from("seasons").update({ is_final: final }).eq("id", seasonId).select("id");
  if (error) return { ok: false, error: explainDbError(error, dict) };
  if (!data?.length) return { ok: false, error: dict.admin.errors.forbidden };

  refresh();
  return { ok: true, message: dict.admin.saved };
}
