import type { Locale } from "./config";

// Official Bulgarian transliteration (Закон за транслитерацията, 2009): the system used in passports.
const LETTERS: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
};

export function transliterate(text: string): string {
  // "-ия" at the end of a word is "-ia" (България → Bulgaria).
  return text.replace(/[Ѐ-ӿ]+/g, (word) => {
    const lower = word.toLowerCase();
    let out = "";
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const isEndingIa = i === word.length - 1 && lower[i] === "я" && lower[i - 1] === "и";
      const latin = isEndingIa ? "a" : (LETTERS[lower[i]] ?? char);
      out += char !== lower[i] ? capitalize(latin, word) : latin;
    }
    return out;
  });
}

// An all-caps word stays all caps (МАРИНОВ → MARINOV); otherwise only the first letter is capital.
function capitalize(latin: string, word: string): string {
  const wordIsUpper = word.length > 1 && word === word.toUpperCase();
  if (wordIsUpper) return latin.toUpperCase();
  return latin.charAt(0).toUpperCase() + latin.slice(1);
}

export function riderName(first: string, last: string, locale: Locale): string {
  const name = `${first} ${last}`;
  return locale === "en" ? transliterate(name) : name;
}

/**
 * Stage names are typed by the organizer, usually only in Bulgarian. Without an English name,
 * English viewers get a generated one ("Day 1 · Navigation") instead of a transliteration.
 */
export function stageName(
  stage: { name: string; name_en?: string | null; type: string; day_number: number },
  locale: Locale,
  labels: { day: string; stageType: Record<string, string> },
): string {
  if (locale !== "en") return stage.name;
  if (stage.name_en) return stage.name_en;
  const type = labels.stageType[stage.type] ?? stage.type;
  return `${labels.day.replace("{n}", String(stage.day_number))} · ${type}`;
}

/** A database row's name in the viewer's language, falling back to Bulgarian. */
export function localizedName(row: { name: string; name_en?: string | null }, locale: Locale): string {
  return locale === "en" && row.name_en ? row.name_en : row.name;
}
