import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { Card, TextField } from "@/components/admin/fields";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { stageName } from "@/i18n/localize";
import { publishResults } from "@/lib/admin/actions/publish";
import { getEventRoles, requireViewer } from "@/lib/auth";
import { formatClock } from "@/lib/format";

// Rulebook protest windows (Р XX): 2 h for navigation, 30 min for everything else.
const DEFAULT_PROTEST_MINUTES: Record<string, number> = { navigation: 120, enduro_cross: 30, round: 30 };

export default async function EventResultsPublishingPage({ params }: PageProps<"/[lang]/admin/events/[eventId]/results">) {
  const { lang, eventId: rawId } = await params;
  const eventId = Number(rawId);
  if (!hasLocale(lang) || !Number.isInteger(eventId)) notFound();
  const dict = getDictionary(lang);
  const p = dict.admin.publish;
  const viewer = await requireViewer(lang, `/${lang}/admin/events/${eventId}/results`);

  const [roles, { data: stages }, { data: publications }] = await Promise.all([
    getEventRoles(viewer, eventId),
    viewer.supabase
      .from("stages")
      .select("id, name, name_en, type, day_number")
      .eq("event_id", eventId)
      .in("type", ["navigation", "enduro_cross"])
      .order("day_number")
      .order("sort_order"),
    viewer.supabase
      .from("publications")
      .select("id, stage_id, state, version, published_at, protest_deadline_at, published_by_name, note")
      .eq("event_id", eventId)
      .order("published_at", { ascending: false }),
  ]);

  const canPublish = viewer.isSuperAdmin || roles.has("organizer") || roles.has("timekeeper") || roles.has("jury_chair");
  const canDeclareOfficial = viewer.isSuperAdmin || roles.has("jury_chair");
  const labels = { day: dict.event.day, stageType: dict.stageType };

  const targets = [
    ...(stages ?? []).map((stage) => ({ key: String(stage.id), stageId: stage.id as number | null, type: stage.type, title: stageName(stage, lang, labels) })),
    ...(stages?.length ? [{ key: "round", stageId: null, type: "round", title: p.round }] : []),
  ];

  const stateLabel = (state: string) => (state === "official" ? dict.publication.official : dict.publication.provisional);

  return (
    <>
      <p className="mb-4 text-sm text-muted">{p.intro}</p>
      {targets.map((target) => {
        const history = (publications ?? []).filter((pub) => pub.stage_id === target.stageId);
        const latest = history[0];
        return (
          <Card key={target.key} title={target.title}>
            {latest ? (
              <p className={`mb-3 text-sm ${latest.state === "official" ? "text-good" : "text-warn"}`}>
                {stateLabel(latest.state)} · {t(dict.publication.version, { n: latest.version })} ·{" "}
                {t(dict.publication.publishedAt, { time: formatClock(latest.published_at) })}
                {latest.protest_deadline_at && ` · ${t(dict.publication.deadline, { time: formatClock(latest.protest_deadline_at) })}`}
              </p>
            ) : (
              <p className="mb-3 text-sm text-muted">{p.notPublished}</p>
            )}

            {target.type === "navigation" && target.stageId && (
              <p className="mb-3 text-sm">
                <a href={`/api/pdf/start-list/${target.stageId}?lang=${lang}`} target="_blank" rel="noreferrer" className="text-accent underline">
                  {p.startListPdf}
                </a>
              </p>
            )}

            {canPublish && (
              <div className="grid gap-4 sm:grid-cols-2">
                <ActionForm action={publishResults} submitLabel={p.provisional} pendingLabel={dict.common.loading}>
                  <input type="hidden" name="lang" value={lang} />
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="stage_id" value={target.stageId ?? "round"} />
                  <input type="hidden" name="state" value="provisional" />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      label={p.protestMinutes}
                      name="protest_minutes"
                      type="number"
                      min={0}
                      defaultValue={DEFAULT_PROTEST_MINUTES[target.type] ?? 30}
                    />
                    <TextField label={p.note} name="note" />
                  </div>
                </ActionForm>
                {canDeclareOfficial && (
                  <ActionForm action={publishResults} submitLabel={p.official} pendingLabel={dict.common.loading}>
                    <input type="hidden" name="lang" value={lang} />
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="stage_id" value={target.stageId ?? "round"} />
                    <input type="hidden" name="state" value="official" />
                    <TextField label={p.note} name="note" />
                  </ActionForm>
                )}
              </div>
            )}

            {history.length > 0 && (
              <>
                <h3 className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-muted">{p.history}</h3>
                <ul className="divide-y divide-border text-sm">
                  {history.map((pub) => (
                    <li key={pub.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <span>
                        v{pub.version} · {stateLabel(pub.state)} · {formatClock(pub.published_at)}
                        {pub.published_by_name && <span className="text-muted"> · {pub.published_by_name}</span>}
                        {pub.note && <span className="text-muted"> · {pub.note}</span>}
                      </span>
                      <span className="flex gap-3 text-xs">
                        {(["bg", "en"] as const).map((pdfLang) => (
                          <a key={pdfLang} href={`/api/pdf/publication/${pub.id}?lang=${pdfLang}`} target="_blank" rel="noreferrer" className="text-accent underline">
                            PDF {pdfLang.toUpperCase()}
                          </a>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        );
      })}
    </>
  );
}
