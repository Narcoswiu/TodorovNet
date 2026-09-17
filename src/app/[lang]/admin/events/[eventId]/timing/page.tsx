import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { Card, SelectField, TextField } from "@/components/admin/fields";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localizedName, stageName } from "@/i18n/localize";
import { addManualPassing, addTimeAdjustment, deleteTimeAdjustment, voidPassing } from "@/lib/admin/actions/timing";
import { getEventRoles, requireViewer } from "@/lib/auth";
import { formatClock, formatDuration } from "@/lib/format";

export default async function EventTimingPage({ params, searchParams }: PageProps<"/[lang]/admin/events/[eventId]/timing">) {
  const { lang, eventId: rawId } = await params;
  const eventId = Number(rawId);
  if (!hasLocale(lang) || !Number.isInteger(eventId)) notFound();
  const dict = getDictionary(lang);
  const text = dict.admin.timing;
  const viewer = await requireViewer(lang, `/${lang}/admin/events/${eventId}/timing`);
  const { supabase } = viewer;

  const [roles, { data: event }, { data: stages }, { data: eventClasses }] = await Promise.all([
    getEventRoles(viewer, eventId),
    supabase.from("events").select("id, date_from").eq("id", eventId).maybeSingle(),
    supabase
      .from("stages")
      .select("id, name, name_en, type, day_number")
      .eq("event_id", eventId)
      .eq("type", "navigation")
      .order("day_number")
      .order("sort_order"),
    supabase.from("event_classes").select("start_order, classes(id, name, name_en)").eq("event_id", eventId).order("start_order"),
  ]);
  if (!event) notFound();

  const labels = { day: dict.event.day, stageType: dict.stageType };
  if (!stages?.length) return <Card title={dict.admin.tabs.timing}><p className="text-sm text-muted">{text.noNavigation}</p></Card>;

  const { stage: stageParam, point: pointParam } = await searchParams;
  const stage = stages.find((s) => String(s.id) === stageParam) ?? stages[0];
  const pointFilter = typeof pointParam === "string" ? pointParam : "";

  const canRecord = viewer.isSuperAdmin || roles.has("organizer") || roles.has("timekeeper");
  const canAdjust = viewer.isSuperAdmin || roles.has("organizer") || roles.has("jury") || roles.has("jury_chair");

  let passingsQuery = supabase
    .from("passings")
    .select("id, point, checkpoint_id, passed_at, source, voided_at, void_reason, entries(race_number, riders(first_name, last_name))")
    .eq("stage_id", stage.id)
    .order("passed_at", { ascending: false })
    .limit(500);
  if (pointFilter === "start" || pointFilter === "finish") passingsQuery = passingsQuery.eq("point", pointFilter);
  if (pointFilter.startsWith("cp:")) passingsQuery = passingsQuery.eq("checkpoint_id", Number(pointFilter.slice(3)));

  const [{ data: checkpoints }, { data: passings }, { data: adjustments }] = await Promise.all([
    supabase.from("checkpoints").select("id, code, name, name_en").eq("stage_id", stage.id).order("sort_order"),
    passingsQuery,
    supabase
      .from("time_adjustments")
      .select("id, class_id, seconds, reason, created_at, entries(race_number, riders(first_name, last_name))")
      .eq("stage_id", stage.id)
      .order("created_at", { ascending: false }),
  ]);

  const classes = (eventClasses ?? []).flatMap((row) => (row.classes ? [row.classes] : []));
  const className = new Map(classes.map((cls) => [cls.id, localizedName(cls, lang)]));
  const checkpointCode = new Map((checkpoints ?? []).map((cp) => [cp.id, cp.code]));
  const pointLabel = (point: string, checkpointId: number | null) =>
    point === "start" ? dict.timing.start : point === "finish" ? dict.timing.finish : (checkpointCode.get(checkpointId ?? 0) ?? "CP");

  const pointOptions = [
    { value: "start", label: dict.timing.start },
    ...(checkpoints ?? []).map((cp) => ({ value: `cp:${cp.id}`, label: `${cp.code} · ${localizedName(cp, lang)}` })),
    { value: "finish", label: dict.timing.finish },
  ];

  // The stage's calendar day: event start date plus (day - 1).
  const [year, month, day] = event.date_from.split("-").map(Number);
  const stageDate = new Date(Date.UTC(year, month - 1, day + stage.day_number - 1)).toISOString().slice(0, 10);

  const tab = (active: boolean) =>
    `whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${active ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`;
  const base = `/${lang}/admin/events/${eventId}/timing?stage=${stage.id}`;

  return (
    <>
      {stages.length > 1 && (
        <nav className="mb-4 flex gap-1 overflow-x-auto">
          {stages.map((s) => (
            <Link key={s.id} href={`?stage=${s.id}`} className={tab(s.id === stage.id)}>
              {stageName(s, lang, labels)}
            </Link>
          ))}
        </nav>
      )}

      {canRecord && (
        <Card title={text.addManual}>
          <ActionForm action={addManualPassing} submitLabel={text.addManual} pendingLabel={dict.common.loading}>
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="stage_id" value={stage.id} />
            <div className="grid gap-3 sm:grid-cols-4">
              <TextField label={text.raceNumber} name="race_number" type="number" min={1} required />
              <SelectField label={text.point} name="point" defaultValue="finish" options={pointOptions} />
              <TextField label={text.date} name="date" type="date" required defaultValue={stageDate} />
              <TextField label={text.time} name="time" type="time" step={1} required />
            </div>
          </ActionForm>
        </Card>
      )}

      <Card title={text.adjustments}>
        <p className="mb-3 text-xs text-muted">{text.adjustmentsHelp}</p>
        {!adjustments?.length && <p className="mb-3 text-sm text-muted">{text.noAdjustments}</p>}
        <ul className="mb-3 divide-y divide-border text-sm">
          {(adjustments ?? []).map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className={`font-mono ${Number(row.seconds) < 0 ? "text-good" : "text-bad"}`}>
                  {Number(row.seconds) < 0 ? "−" : "+"}
                  {formatDuration(Math.abs(Number(row.seconds)))}
                </span>{" "}
                {row.entries
                  ? `#${row.entries.race_number} ${row.entries.riders?.first_name ?? ""} ${row.entries.riders?.last_name ?? ""}`
                  : className.get(row.class_id ?? 0)}
                <span className="ml-2 text-xs text-muted">{row.reason}</span>
              </span>
              {canAdjust && (
                <ActionButton action={deleteTimeAdjustment} fields={{ lang, adjustment_id: row.id }} label={text.delete} pendingLabel="…" tone="bad" />
              )}
            </li>
          ))}
        </ul>
        {canAdjust && (
          <ActionForm action={addTimeAdjustment} submitLabel={text.addAdjustment} pendingLabel={dict.common.loading}>
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="stage_id" value={stage.id} />
            <div className="grid gap-3 sm:grid-cols-5">
              <SelectField
                label={text.scope}
                name="scope"
                options={[
                  { value: "rider", label: text.scopeRider },
                  { value: "class", label: text.scopeClass },
                ]}
              />
              <TextField label={text.raceNumber} name="race_number" type="number" min={1} />
              <SelectField label={dict.admin.entries.class} name="class_id" options={classes.map((cls) => ({ value: cls.id, label: localizedName(cls, lang) }))} />
              <TextField label={text.minutes} name="minutes" type="text" inputMode="decimal" required placeholder="-15" />
              <TextField label={text.reason} name="reason" required />
            </div>
          </ActionForm>
        )}
      </Card>

      <Card title={t(text.count, { n: passings?.length ?? 0 })}>
        <nav className="mb-3 flex flex-wrap gap-1">
          <Link href={base} className={tab(!pointFilter)}>
            {text.allPoints}
          </Link>
          {pointOptions.map((option) => (
            <Link key={option.value} href={`${base}&point=${option.value}`} className={tab(pointFilter === option.value)}>
              {option.value.startsWith("cp:") ? checkpointCode.get(Number(option.value.slice(3))) : option.label}
            </Link>
          ))}
        </nav>
        {!passings?.length && <p className="text-sm text-muted">{text.none}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <tbody>
              {(passings ?? []).map((row) => (
                <tr key={row.id} className={`border-t border-border align-top ${row.voided_at ? "text-muted" : ""}`}>
                  <td className="py-2 pr-2 font-mono tabular-nums">{formatClock(row.passed_at)}</td>
                  <td className="py-2 pr-2 text-right font-mono tabular-nums">{row.entries?.race_number}</td>
                  <td className="py-2 pr-2">
                    <span className={row.voided_at ? "line-through" : ""}>
                      {row.entries?.riders?.first_name} {row.entries?.riders?.last_name}
                    </span>
                    {row.voided_at && <div className="text-xs">{t(text.voided, { reason: row.void_reason ?? "" })}</div>}
                  </td>
                  <td className="py-2 pr-2">{pointLabel(row.point, row.checkpoint_id)}</td>
                  <td className="py-2 pr-2 text-xs text-muted">{text.source[row.source as keyof typeof text.source]}</td>
                  <td className="py-2 text-right">
                    {canRecord && !row.voided_at && (
                      <ActionButton
                        action={voidPassing}
                        fields={{ lang, passing_id: row.id }}
                        input={{ name: "reason", placeholder: text.voidReason, required: true }}
                        label={text.void}
                        pendingLabel="…"
                        tone="bad"
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
