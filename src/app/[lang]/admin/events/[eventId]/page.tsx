import { notFound, redirect } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { allowedTabs, getEventRoles, requireViewer } from "@/lib/auth";

// Opens the first tab this person works in.
export default async function AdminEventIndex({ params }: PageProps<"/[lang]/admin/events/[eventId]">) {
  const { lang, eventId: rawId } = await params;
  const eventId = Number(rawId);
  if (!hasLocale(lang) || !Number.isInteger(eventId)) notFound();
  const viewer = await requireViewer(lang, `/${lang}/admin/events/${eventId}`);
  const [first] = allowedTabs(await getEventRoles(viewer, eventId), viewer.isSuperAdmin);
  if (!first) notFound();
  redirect(`/${lang}/admin/events/${eventId}/${first}`);
}
