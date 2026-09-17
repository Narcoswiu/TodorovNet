"use client";

import { useState, useTransition } from "react";
import { t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { mapRows, readSpreadsheet, type ImportReport, type ImportRow } from "@/lib/admin/spreadsheet";

type ImportAction = (
  lang: string,
  targetId: number,
  rows: ImportRow[],
) => Promise<{ ok: true; report: ImportReport } | { ok: false; error: string }>;

/** Spreadsheet import shared by event entries and the season number registry: the action decides where rows go. */
export function ImportEntries({
  lang,
  dict,
  targetId,
  action,
}: {
  lang: Locale;
  dict: Dictionary;
  targetId: number;
  action: ImportAction;
}) {
  const text = dict.admin.entries;
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setReport(null);
    setRows(null);
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { rows: mapped, missing } = mapRows(await readSpreadsheet(file));
      if (missing.length) {
        const labels = { race_number: text.raceNumber, name: `${text.firstName} + ${text.lastName}`, class: text.class };
        setError(t(text.missingColumns, { columns: missing.map((column) => labels[column]).join(", ") }));
        return;
      }
      setRows(mapped);
    } catch {
      setError(text.unreadable);
    }
  }

  function run() {
    if (!rows) return;
    startTransition(async () => {
      const result = await action(lang, targetId, rows);
      if (result.ok) {
        setReport(result.report);
        setRows(null);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted">{text.importHelp}</p>
      <input
        type="file"
        accept=".xlsx,.csv,.txt"
        onChange={onFile}
        className="block text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm"
      />

      {error && (
        <p role="alert" className="mt-3 text-sm text-bad">
          {error}
        </p>
      )}

      {rows && (
        <div className="mt-4">
          <p className="mb-2 text-sm">{t(text.importPreview, { n: rows.length })}</p>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="text-muted">
                <tr>
                  {[text.raceNumber, text.firstName, text.lastName, text.class, text.club, text.country].map((label) => (
                    <th key={label} className="px-2 py-1 text-left font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((row, index) => (
                  <tr key={index} className="border-t border-border">
                    <td className="px-2 py-1 font-mono">{row.race_number}</td>
                    <td className="px-2 py-1">{row.first_name}</td>
                    <td className="px-2 py-1">{row.last_name}</td>
                    <td className="px-2 py-1">{row.class}</td>
                    <td className="px-2 py-1">{row.club}</td>
                    <td className="px-2 py-1">{row.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {pending ? dict.common.loading : text.importRun}
          </button>
        </div>
      )}

      {report && (
        <div className="mt-4 text-sm">
          <p className={report.errors.length ? "text-warn" : "text-good"}>
            {t(text.importResult, { added: report.added, updated: report.updated, errors: report.errors.length })}
          </p>
          {report.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-bad">
              {report.errors.map((item) => (
                <li key={item.line}>{t(text.importLine, { line: item.line, message: item.message })}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
