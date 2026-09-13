import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { formatClock } from "@/lib/format";
import { StartListDocument, type StartListRow } from "@/lib/pdf/documents";
import { createClient } from "@/lib/supabase/server";

// GET /api/pdf/start-list/7?lang=bg → the current start list of stage 7 as PDF.
export async function GET(request: Request, { params }: RouteContext<"/api/pdf/start-list/[stageId]">) {
  const { stageId: rawStageId } = await params;
  const langParam = new URL(request.url).searchParams.get("lang") ?? "";
  const lang = hasLocale(langParam) ? langParam : defaultLocale;
  const stageId = Number(rawStageId);
  if (!Number.isInteger(stageId)) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: stage } = await supabase
    .from("stages")
    .select("id, event_id, name, name_en, type, day_number, events(name, location, date_from, date_to, round_number)")
    .eq("id", stageId)
    .maybeSingle();
  if (!stage?.events) return new Response("Not found", { status: 404 });

  const [{ data: eventClasses }, { data: slots }] = await Promise.all([
    supabase
      .from("event_classes")
      .select("start_order, classes(id, code, name, name_en)")
      .eq("event_id", stage.event_id)
      .order("start_order"),
    supabase
      .from("start_slots")
      .select("position, scheduled_start, entry_id, entries(class_id, race_number, riders(first_name, last_name, country), clubs(name))")
      .eq("stage_id", stageId)
      .order("position"),
  ]);

  const rows: StartListRow[] = (slots ?? []).flatMap((slot) =>
    slot.entries
      ? [
          {
            entry_id: slot.entry_id,
            position: slot.position,
            scheduled_start: slot.scheduled_start,
            class_id: slot.entries.class_id,
            race_number: slot.entries.race_number,
            first_name: slot.entries.riders?.first_name ?? "",
            last_name: slot.entries.riders?.last_name ?? "",
            country: slot.entries.riders?.country ?? "",
            club: slot.entries.clubs?.name ?? null,
          },
        ]
      : [],
  );
  const classes = (eventClasses ?? []).flatMap((row) => (row.classes ? [row.classes] : []));

  const pdf = await renderToBuffer(
    createElement(StartListDocument, {
      lang,
      dict: getDictionary(lang),
      event: stage.events,
      stage,
      classes,
      rows,
      generatedAt: formatClock(new Date()),
    }) as unknown as ReactElement<DocumentProps>, // StartListDocument renders a <Document> root
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="start-list-day${stage.day_number}-${lang}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
