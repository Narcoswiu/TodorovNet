import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { Card } from "@/components/admin/fields";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localizedName } from "@/i18n/localize";
import { saveEventClasses } from "@/lib/admin/actions/classes";
import { requireViewer } from "@/lib/auth";

export default async function EventClassesPage({ params }: PageProps<"/[lang]/admin/events/[eventId]/classes">) {
  const { lang, eventId: rawId } = await params;
  const eventId = Number(rawId);
  if (!hasLocale(lang) || !Number.isInteger(eventId)) notFound();
  const dict = getDictionary(lang);
  const viewer = await requireViewer(lang, `/${lang}/admin/events/${eventId}/classes`);
  const { supabase } = viewer;

  const { data: event } = await supabase.from("events").select("id, season_id").eq("id", eventId).maybeSingle();
  if (!event) notFound();

  // A free event without a season borrows the latest season's class list.
  let seasonId = event.season_id;
  if (!seasonId) {
    const { data: latest } = await supabase.from("seasons").select("id").order("year", { ascending: false }).limit(1).maybeSingle();
    seasonId = latest?.id ?? null;
  }

  const classesQuery = supabase.from("classes").select("id, code, name, name_en, sort_order").order("sort_order");
  const [{ data: classes }, { data: chosen }] = await Promise.all([
    seasonId ? classesQuery.eq("season_id", seasonId) : classesQuery.is("season_id", null),
    supabase.from("event_classes").select("class_id, start_order").eq("event_id", eventId),
  ]);
  const chosenOrder = new Map((chosen ?? []).map((row) => [row.class_id, row.start_order]));

  return (
    <Card title={dict.admin.tabs.classes}>
      <p className="mb-3 text-sm text-muted">{dict.admin.classesPage.intro}</p>
      <ActionForm action={saveEventClasses} submitLabel={dict.admin.save} pendingLabel={dict.common.loading}>
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="event_id" value={eventId} />
        <table className="w-full text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="w-10 py-1" />
              <th className="py-1 text-left font-medium">{dict.admin.entries.class}</th>
              <th className="w-28 py-1 text-right font-medium">{dict.admin.classesPage.order}</th>
            </tr>
          </thead>
          <tbody>
            {(classes ?? []).map((cls) => (
              <tr key={cls.id} className="border-t border-border">
                <td className="py-2">
                  <input
                    type="checkbox"
                    name="class_id"
                    value={cls.id}
                    defaultChecked={chosenOrder.has(cls.id)}
                    aria-label={localizedName(cls, lang)}
                    className="size-4 accent-[var(--accent)]"
                  />
                </td>
                <td className="py-2">
                  {localizedName(cls, lang)} <span className="text-xs text-muted">{cls.code}</span>
                </td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    name={`order_${cls.id}`}
                    aria-label={`${localizedName(cls, lang)}: ${dict.admin.stages.order}`}
                    defaultValue={chosenOrder.get(cls.id) ?? cls.sort_order}
                    className="w-20 rounded border border-border bg-background px-2 py-1 text-right"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ActionForm>
    </Card>
  );
}
