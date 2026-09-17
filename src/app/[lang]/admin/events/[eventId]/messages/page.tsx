import { notFound } from "next/navigation";
import { LiveMessages, type CourseMessage } from "@/components/admin/live-messages";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getEventRoles, requireViewer } from "@/lib/auth";

export default async function EventMessagesPage({ params }: PageProps<"/[lang]/admin/events/[eventId]/messages">) {
  const { lang, eventId: rawId } = await params;
  const eventId = Number(rawId);
  if (!hasLocale(lang) || !Number.isInteger(eventId)) notFound();
  const dict = getDictionary(lang);
  const viewer = await requireViewer(lang, `/${lang}/admin/events/${eventId}/messages`);
  const { supabase } = viewer;

  const [roles, { data: rows }, { data: entries }, { data: checkpoints }, { data: staff }] = await Promise.all([
    getEventRoles(viewer, eventId),
    supabase
      .from("marshal_messages")
      .select("id, kind, race_number, body, lat, lon, accuracy_m, sent_at, resolved_at, checkpoint_id, created_by")
      .eq("event_id", eventId)
      .order("resolved_at", { ascending: false, nullsFirst: true })
      .order("sent_at", { ascending: false })
      .limit(200),
    supabase.from("entries").select("race_number, riders(first_name, last_name)").eq("event_id", eventId),
    supabase.from("checkpoints").select("id, code").eq("event_id", eventId),
    supabase.rpc("event_staff_members", { p_event_id: eventId }),
  ]);

  const riderByNumber = new Map((entries ?? []).map((entry) => [entry.race_number, `${entry.riders?.first_name ?? ""} ${entry.riders?.last_name ?? ""}`]));
  const checkpointCode = new Map((checkpoints ?? []).map((cp) => [cp.id, cp.code]));
  const senderName = new Map((staff ?? []).map((member) => [member.user_id, member.full_name || member.email]));

  const messages: CourseMessage[] = (rows ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    race_number: row.race_number,
    body: row.body,
    lat: row.lat,
    lon: row.lon,
    accuracy_m: row.accuracy_m,
    sent_at: row.sent_at,
    resolved_at: row.resolved_at,
    checkpoint: row.checkpoint_id ? (checkpointCode.get(row.checkpoint_id) ?? null) : null,
    rider: row.race_number ? (riderByNumber.get(row.race_number) ?? null) : null,
    sender: row.created_by ? (senderName.get(row.created_by) ?? null) : null,
  }));

  // Open SOS first, then the rest by time: the list is sorted so nothing urgent scrolls away.
  messages.sort((a, b) => {
    const rank = (m: CourseMessage) => (m.resolved_at ? 2 : m.kind === "sos" ? 0 : 1);
    return rank(a) - rank(b) || b.sent_at.localeCompare(a.sent_at);
  });

  const canResolve = viewer.isSuperAdmin || ["organizer", "timekeeper", "jury", "jury_chair"].some((role) => roles.has(role as never));

  return <LiveMessages lang={lang} dict={dict} eventId={eventId} messages={messages} canResolve={canResolve} />;
}
