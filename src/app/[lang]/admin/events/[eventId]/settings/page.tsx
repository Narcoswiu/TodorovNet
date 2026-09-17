import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { EventFields } from "@/components/admin/event-fields";
import { Card } from "@/components/admin/fields";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireViewer } from "@/lib/auth";
import { updateEvent } from "../../../actions";

export default async function EventSettingsPage({ params }: PageProps<"/[lang]/admin/events/[eventId]/settings">) {
  const { lang, eventId: rawId } = await params;
  const eventId = Number(rawId);
  if (!hasLocale(lang) || !Number.isInteger(eventId)) notFound();
  const dict = getDictionary(lang);
  const viewer = await requireViewer(lang, `/${lang}/admin/events/${eventId}/settings`);

  const [{ data: event }, { data: seasons }] = await Promise.all([
    viewer.supabase
      .from("events")
      .select("id, name, location, date_from, date_to, kind, season_id, round_number, status, ranking")
      .eq("id", eventId)
      .maybeSingle(),
    viewer.supabase.from("seasons").select("id, year, name").order("year", { ascending: false }),
  ]);
  if (!event) notFound();

  return (
    <Card title={dict.admin.tabs.settings}>
      <ActionForm action={updateEvent} submitLabel={dict.admin.save} pendingLabel={dict.common.loading}>
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="event_id" value={event.id} />
        <EventFields dict={dict} seasons={seasons ?? []} values={event} />
      </ActionForm>
    </Card>
  );
}
