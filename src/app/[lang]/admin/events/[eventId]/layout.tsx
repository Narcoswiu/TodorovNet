import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { allowedTabs, getEventRoles, requireViewer } from "@/lib/auth";

export default async function AdminEventLayout({ children, params }: LayoutProps<"/[lang]/admin/events/[eventId]">) {
  const { lang, eventId: rawId } = await params;
  const eventId = Number(rawId);
  if (!hasLocale(lang) || !Number.isInteger(eventId)) notFound();
  const dict = getDictionary(lang);
  const viewer = await requireViewer(lang, `/${lang}/admin/events/${eventId}`);

  const [{ data: event }, roles] = await Promise.all([
    viewer.supabase.from("events").select("id, name, status").eq("id", eventId).maybeSingle(),
    getEventRoles(viewer, eventId),
  ]);
  if (!event) notFound();

  const tabs = allowedTabs(roles, viewer.isSuperAdmin);
  if (!tabs.length) notFound();

  return (
    <>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{event.name}</h1>
        <Link href={`/${lang}/e/${event.id}`} className="text-sm text-muted underline hover:text-foreground">
          {dict.admin.publicPage} ↗
        </Link>
      </div>
      <AdminTabs
        base={`/${lang}/admin/events/${eventId}`}
        tabs={tabs.map((key) => ({ key, label: dict.admin.tabs[key] }))}
      />
      {children}
    </>
  );
}
