import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localizedName, riderName, transliterate } from "@/i18n/localize";
import { numberPlateStyle } from "@/lib/classes";
import { formatClock } from "@/lib/format";
import type { ClassInfo, EntryInfo, StartSlot } from "@/lib/results/queries";

/** Public start list for a navigation day, grouped by class in start order. */
export function StartList({
  lang,
  dict,
  slots,
  classes,
  entries,
}: {
  lang: Locale;
  dict: Dictionary;
  slots: StartSlot[];
  classes: ClassInfo[];
  entries: EntryInfo[];
}) {
  if (!slots.length) {
    return <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted">{dict.event.noStartList}</p>;
  }

  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const firstPosition = (classId: number) =>
    Math.min(...slots.filter((slot) => entryById.get(slot.entry_id)?.class_id === classId).map((slot) => slot.position));
  const ordered = classes
    .filter((cls) => slots.some((slot) => entryById.get(slot.entry_id)?.class_id === cls.id))
    .sort((a, b) => firstPosition(a.id) - firstPosition(b.id));

  return (
    <div>
      {ordered.map((cls) => (
        <section key={cls.id} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{localizedName(cls, lang)}</h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-card px-3">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="whitespace-nowrap py-2 pr-2 text-right font-medium">#</th>
                  <th className="whitespace-nowrap py-2 pr-2 text-left font-medium">{dict.results.start}</th>
                  <th className="whitespace-nowrap py-2 pr-2 text-right font-medium">{dict.results.number}</th>
                  <th className="whitespace-nowrap py-2 text-left font-medium">{dict.results.rider}</th>
                </tr>
              </thead>
              <tbody>
                {slots
                  .filter((slot) => entryById.get(slot.entry_id)?.class_id === cls.id)
                  .map((slot) => {
                    const entry = entryById.get(slot.entry_id);
                    return (
                      <tr key={slot.entry_id} className="border-t border-border">
                        <td className="py-2 pr-2 text-right text-muted tabular-nums">{slot.position}</td>
                        <td className="py-2 pr-2 font-mono text-sm tabular-nums">{formatClock(slot.scheduled_start)}</td>
                        <td className="py-2 pr-2 text-right">
                          <span
                            className="inline-block min-w-10 rounded border border-border px-1.5 py-0.5 text-center font-mono text-sm font-semibold tabular-nums"
                            style={numberPlateStyle(cls.number_bg, cls.number_fg)}
                          >
                            {entry?.race_number}
                          </span>
                        </td>
                        <td className="w-full py-2">
                          {entry && (
                            <>
                              <div className="font-medium leading-tight">{riderName(entry.first_name, entry.last_name, lang)}</div>
                              {entry.club && (
                                <div className="text-xs text-muted">{lang === "en" ? transliterate(entry.club) : entry.club}</div>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
