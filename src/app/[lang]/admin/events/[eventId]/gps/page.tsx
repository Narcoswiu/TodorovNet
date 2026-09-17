import { notFound } from "next/navigation";
import { GpsCheck } from "@/components/admin/gps-check";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localizedName, stageName } from "@/i18n/localize";
import { requireViewer } from "@/lib/auth";

export default async function EventGpsPage({ params }: PageProps<"/[lang]/admin/events/[eventId]/gps">) {
  const { lang, eventId: rawId } = await params;
  const eventId = Number(rawId);
  if (!hasLocale(lang) || !Number.isInteger(eventId)) notFound();
  const dict = getDictionary(lang);
  const viewer = await requireViewer(lang, `/${lang}/admin/events/${eventId}/gps`);
  const { supabase } = viewer;

  const [{ data: stages }, { data: eventClasses }, { data: tracks }, { data: entries }, { data: types }] = await Promise.all([
    supabase
      .from("stages")
      .select("id, name, name_en, type, day_number")
      .eq("event_id", eventId)
      .eq("type", "navigation")
      .order("day_number")
      .order("sort_order"),
    supabase.from("event_classes").select("start_order, classes(id, name, name_en)").eq("event_id", eventId).order("start_order"),
    supabase
      .from("stage_tracks")
      .select("id, stage_id, class_id, name, storage_path, point_count, length_m, mandatory_waypoints")
      .eq("event_id", eventId),
    supabase.from("entries").select("race_number, riders(first_name, last_name)").eq("event_id", eventId).eq("withdrawn", false),
    supabase
      .from("penalty_types")
      .select("id, code, name, name_en, event_id")
      .or(`event_id.is.null,event_id.eq.${eventId}`)
      .eq("active", true),
  ]);

  const labels = { day: dict.event.day, stageType: dict.stageType };
  // An event-specific type overrides the default catalogue entry with the same code.
  const byCode = new Map<string, { id: number; code: string; name: string }>();
  for (const type of (types ?? []).sort((a, b) => Number(a.event_id != null) - Number(b.event_id != null))) {
    byCode.set(type.code, { id: type.id, code: type.code, name: localizedName(type, lang) });
  }

  return (
    <GpsCheck
      lang={lang}
      dict={dict}
      eventId={eventId}
      stages={(stages ?? []).map((stage) => ({ id: stage.id, label: stageName(stage, lang, labels) }))}
      classes={(eventClasses ?? []).flatMap((row) => (row.classes ? [{ id: row.classes.id, name: localizedName(row.classes, lang) }] : []))}
      tracks={(tracks ?? []).map((track) => ({ ...track, length_m: track.length_m == null ? null : Number(track.length_m) }))}
      entries={(entries ?? []).map((entry) => ({
        race_number: entry.race_number,
        name: `${entry.riders?.first_name ?? ""} ${entry.riders?.last_name ?? ""}`,
      }))}
      penaltyTypes={[...byCode.values()]}
    />
  );
}
