import type { Locale } from "./config";
import { bg, type Dictionary } from "./dictionaries/bg";
import { en } from "./dictionaries/en";

const dictionaries: Record<Locale, Dictionary> = { bg, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
