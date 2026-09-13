import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { EventFields } from "@/components/admin/event-fields";
import { Card } from "@/components/admin/fields";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireViewer } from "@/lib/auth";
import { createEvent } from "../../actions";

export default async function NewEventPage({ params }: PageProps<"/[lang]/admin/events/new">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const viewer = await requireViewer(lang, `/${lang}/admin/events/new`);
  if (!viewer.isSuperAdmin) notFound();

  const { data: seasons } = await viewer.supabase.from("seasons").select("id, year, name").order("year", { ascending: false });

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold tracking-tight">{dict.admin.newEvent}</h1>
      <Card>
        <ActionForm action={createEvent} submitLabel={dict.admin.create} pendingLabel={dict.common.loading}>
          <input type="hidden" name="lang" value={lang} />
          <EventFields dict={dict} seasons={seasons ?? []} />
        </ActionForm>
      </Card>
    </>
  );
}
