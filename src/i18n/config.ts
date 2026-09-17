export const locales = ["bg", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "bg";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function hasLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Cookie choice first, then the browser's language list; Bulgarian when nothing matches. */
export function negotiateLocale(cookieValue: string | undefined, acceptLanguage: string | null): Locale {
  if (cookieValue && hasLocale(cookieValue)) return cookieValue;

  const preferred = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .filter((entry) => entry.lang)
    .sort((a, b) => b.q - a.q);

  for (const { lang } of preferred) {
    if (hasLocale(lang)) return lang;
  }
  return defaultLocale;
}

/** Replaces {name} placeholders: t("{n} чакат", { n: 3 }) */
export function t(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
