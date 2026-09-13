import { defaultLocale, hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

// Helpers for reading admin forms. Values come from FormData as strings; empty means "not set".

export function formContext(formData: FormData) {
  const raw = String(formData.get("lang") ?? "");
  const lang: Locale = hasLocale(raw) ? raw : defaultLocale;
  return { lang, dict: getDictionary(lang) };
}

export function textField(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/** Integer or null when empty. NaN when present but not an integer, so callers can reject it. */
export function intField(formData: FormData, name: string): number | null {
  const raw = textField(formData, name);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : Number.NaN;
}

export function numberField(formData: FormData, name: string): number | null {
  const raw = textField(formData, name).replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.NaN;
}

export function isValidId(value: number | null): value is number {
  return value != null && Number.isInteger(value) && value > 0;
}
