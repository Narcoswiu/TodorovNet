import { t } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string } | null;

export type FormAction = (previous: ActionResult, formData: FormData) => Promise<ActionResult>;

/** Turns a Postgres/PostgREST error into a sentence an official can act on. */
export function explainDbError(error: { code?: string; message: string }, dict: Dictionary): string {
  switch (error.code) {
    case "42501":
      return dict.admin.errors.forbidden;
    case "23505":
      return dict.admin.errors.duplicate;
    case "23503":
      return dict.admin.errors.inUse;
    case "23514":
    case "22P02":
    case "22007":
      return dict.admin.errors.invalid;
    default:
      return t(dict.admin.errors.generic, { message: error.message });
  }
}
