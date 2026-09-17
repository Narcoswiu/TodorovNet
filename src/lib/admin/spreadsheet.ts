import Papa from "papaparse";

// Reads an entry list from .xlsx or .csv in the browser and maps its columns by header name,
// in Bulgarian or English, whatever order the organizer's file happens to use.

export type ImportRow = {
  race_number: string;
  first_name: string;
  last_name: string;
  class: string;
  club: string;
  country: string;
  birth_date: string;
  phone: string;
  email: string;
  license_number: string;
};

export type ImportReport = { added: number; updated: number; errors: { line: number; message: string }[] };

type Column = keyof ImportRow | "full_name";

const ALIASES: Record<Column, string[]> = {
  race_number: ["номер", "стартов номер", "ст №", "№", "no", "number", "race number", "racenumber", "#"],
  first_name: ["име", "собствено име", "собствено", "first name", "firstname", "first"],
  last_name: ["фамилия", "фамилно име", "фамилно", "last name", "lastname", "surname", "last"],
  full_name: ["състезател", "участник", "име и фамилия", "rider", "name", "full name", "fullname"],
  class: ["клас", "категория", "class", "category", "cat"],
  club: ["клуб", "отбор", "club", "team", "entrant"],
  country: ["държава", "националност", "country", "nat", "nationality"],
  birth_date: ["рождена дата", "дата на раждане", "birth date", "birthdate", "date of birth", "dob"],
  phone: ["телефон", "тел", "phone", "mobile"],
  email: ["имейл", "мейл", "email", "e mail"],
  license_number: ["лиценз", "лиценз №", "license", "licence", "license number", "licence number"],
};

const normalize = (header: string) =>
  header
    .toLowerCase()
    .replace(/[„“"'’]/g, "")
    .replace(/[\s._\-]+/g, " ")
    .trim();

const LOOKUP = new Map<string, Column>(
  (Object.entries(ALIASES) as [Column, string[]][]).flatMap(([column, names]) =>
    names.map((name) => [normalize(name), column] as const),
  ),
);

export async function readSpreadsheet(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const data = await readSheet(file);
    return data.map((row) => row.map(cellToText));
  }

  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const bytes = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(bytes);
    // Excel on Bulgarian Windows saves CSV as Windows-1251; UTF-8 decoding then shows replacement characters.
    if (text.includes("�")) text = new TextDecoder("windows-1251").decode(bytes);
    const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: true });
    return parsed.data.map((row) => row.map((cell) => String(cell ?? "").trim()));
  }

  throw new Error("Unsupported file type");
}

export function mapRows(table: string[][]): { rows: ImportRow[]; missing: ("race_number" | "name" | "class")[] } {
  const [header = [], ...body] = table;
  const index: Partial<Record<Column, number>> = {};
  header.forEach((cell, position) => {
    const column = LOOKUP.get(normalize(cell));
    if (column && index[column] === undefined) index[column] = position;
  });

  const hasName = (index.first_name !== undefined && index.last_name !== undefined) || index.full_name !== undefined;
  const missing = [
    index.race_number === undefined ? ("race_number" as const) : null,
    hasName ? null : ("name" as const),
    index.class === undefined ? ("class" as const) : null,
  ].filter((value) => value !== null);

  const rows = body
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => {
      const get = (column: Column) => {
        const position = index[column];
        return position === undefined ? "" : (row[position] ?? "").trim();
      };
      let first = get("first_name");
      let last = get("last_name");
      if ((!first || !last) && index.full_name !== undefined) {
        const parts = get("full_name").split(/\s+/).filter(Boolean);
        first = parts.shift() ?? "";
        last = parts.join(" ");
      }
      return {
        race_number: get("race_number"),
        first_name: first,
        last_name: last,
        class: get("class"),
        club: get("club"),
        country: get("country"),
        birth_date: normalizeDate(get("birth_date")),
        phone: get("phone"),
        email: get("email"),
        license_number: get("license_number"),
      };
    });

  return { rows, missing };
}

function cellToText(cell: unknown): string {
  if (cell == null) return "";
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell).trim();
}

/** 01.05.1990, 1/5/1990 or 1990-05-01 → 1990-05-01. Anything else is dropped rather than guessed. */
function normalizeDate(value: string): string {
  const dayFirst = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(value);
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
}
