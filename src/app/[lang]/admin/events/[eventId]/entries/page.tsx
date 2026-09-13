import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { Card, SelectField, TextField } from "@/components/admin/fields";
import { ImportEntries } from "@/components/admin/import-entries";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localizedName } from "@/i18n/localize";
import { addEntry, setWithdrawn } from "@/lib/admin/actions/entries";
import { requireViewer } from "@/lib/auth";

export default async function EventEntriesPage({ params }: PageProps<"/[lang]/admin/events/[eventId]/entries">) {
  const { lang, eventId: rawId } = await params;
  const eventId = Number(rawId);
  if (!hasLocale(lang) || !Number.isInteger(eventId)) notFound();
  const dict = getDictionary(lang);
  const text = dict.admin.entries;
  const viewer = await requireViewer(lang, `/${lang}/admin/events/${eventId}/entries`);

  const [{ data: entries }, { data: eventClasses }] = await Promise.all([
    viewer.supabase
      .from("entries")
      .select("id, race_number, withdrawn, class_id, riders(first_name, last_name, country), clubs(name)")
      .eq("event_id", eventId)
      .order("race_number"),
    viewer.supabase
      .from("event_classes")
      .select("start_order, classes(id, code, name, name_en)")
      .eq("event_id", eventId)
      .order("start_order"),
  ]);
  const classes = (eventClasses ?? []).flatMap((row) => (row.classes ? [row.classes] : []));
  const classById = new Map(classes.map((cls) => [cls.id, cls]));
  const active = (entries ?? []).filter((entry) => !entry.withdrawn).length;

  return (
    <>
      {!classes.length && <p className="mb-4 rounded-md border border-warn px-3 py-2 text-sm text-warn">{text.noClasses}</p>}

      <Card title={text.add}>
        <ActionForm action={addEntry} submitLabel={text.add} pendingLabel={dict.common.loading}>
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="event_id" value={eventId} />
          <div className="grid gap-3 sm:grid-cols-4">
            <TextField label={text.raceNumber} name="race_number" type="number" min={1} required />
            <TextField label={text.firstName} name="first_name" required />
            <TextField label={text.lastName} name="last_name" required />
            <SelectField
              label={text.class}
              name="class"
              required
              options={classes.map((cls) => ({ value: cls.code, label: localizedName(cls, lang) }))}
            />
            <TextField label={text.club} name="club" />
            <TextField label={text.country} name="country" maxLength={2} placeholder="BG" />
            <TextField label={text.birthDate} name="birth_date" type="date" />
            <TextField label={text.phone} name="phone" type="tel" />
          </div>
        </ActionForm>
      </Card>

      <Card title={text.import}>
        <ImportEntries lang={lang} dict={dict} eventId={eventId} />
      </Card>

      <Card title={t(text.count, { n: active })}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 pr-2 text-right font-medium">{text.raceNumber}</th>
                <th className="py-1 pr-2 text-left font-medium">{dict.results.rider}</th>
                <th className="py-1 pr-2 text-left font-medium">{text.class}</th>
                <th className="py-1 pr-2 text-left font-medium">{text.club}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {(entries ?? []).map((entry) => {
                const cls = classById.get(entry.class_id);
                return (
                  <tr key={entry.id} className={`border-t border-border ${entry.withdrawn ? "text-muted line-through" : ""}`}>
                    <td className="py-2 pr-2 text-right font-mono tabular-nums">{entry.race_number}</td>
                    <td className="py-2 pr-2">
                      {entry.riders?.first_name} {entry.riders?.last_name}
                      {entry.riders?.country && entry.riders.country !== "BG" && (
                        <span className="ml-1 text-xs text-muted">{entry.riders.country}</span>
                      )}
                    </td>
                    <td className="py-2 pr-2">{cls ? localizedName(cls, lang) : ""}</td>
                    <td className="py-2 pr-2 text-muted">{entry.clubs?.name}</td>
                    <td className="py-2 text-right">
                      <ActionButton
                        action={setWithdrawn}
                        fields={{ lang, entry_id: entry.id, withdrawn: entry.withdrawn ? "false" : "true" }}
                        label={entry.withdrawn ? text.reinstate : text.withdraw}
                        pendingLabel="…"
                        tone={entry.withdrawn ? "good" : "default"}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
