import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { Card } from "@/components/admin/fields";
import { StageFields } from "@/components/admin/stage-fields";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { stageName } from "@/i18n/localize";
import { createStage } from "@/lib/admin/actions/stages";
import { requireViewer } from "@/lib/auth";
import { formatClock } from "@/lib/format";

export default async function EventStagesPage({ params }: PageProps<"/[lang]/admin/events/[eventId]/stages">) {
  const { lang, eventId: rawId } = await params;
  const eventId = Number(rawId);
  if (!hasLocale(lang) || !Number.isInteger(eventId)) notFound();
  const dict = getDictionary(lang);
  const s = dict.admin.stages;
  const viewer = await requireViewer(lang, `/${lang}/admin/events/${eventId}/stages`);

  const [{ data: stages }, { data: scales }] = await Promise.all([
    viewer.supabase
      .from("stages")
      .select("id, name, name_en, type, day_number, first_start_at, course_closes_at, points_scale")
      .eq("event_id", eventId)
      .order("day_number")
      .order("sort_order"),
    viewer.supabase.from("points_scales").select("code, name").order("code"),
  ]);

  return (
    <>
      <Card title={dict.admin.tabs.stages}>
        {!stages?.length && <p className="text-sm text-muted">{s.none}</p>}
        <ul className="divide-y divide-border">
          {(stages ?? []).map((stage) => (
            <li key={stage.id}>
              <Link
                href={`/${lang}/admin/events/${eventId}/stages/${stage.id}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2 hover:text-accent"
              >
                <span className="font-medium">{stageName(stage, lang, { day: dict.event.day, stageType: dict.stageType })}</span>
                <span className="text-xs text-muted">
                  {dict.stageType[stage.type as keyof typeof dict.stageType]}
                  {stage.first_start_at && ` · ${s.firstStart} ${formatClock(stage.first_start_at)}`}
                  {stage.course_closes_at && ` · ${s.closesAt} ${formatClock(stage.course_closes_at)}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={s.add}>
        <ActionForm action={createStage} submitLabel={dict.admin.create} pendingLabel={dict.common.loading}>
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="event_id" value={eventId} />
          <StageFields dict={dict} scales={scales ?? []} />
        </ActionForm>
      </Card>
    </>
  );
}
