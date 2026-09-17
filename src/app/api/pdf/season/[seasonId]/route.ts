import type { DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { formatClock } from "@/lib/format";
import { SeasonDocument } from "@/lib/pdf/documents";
import { renderPdf } from "@/lib/pdf/render";
import { loadSeasonStandings } from "@/lib/results/season";
import { createClient } from "@/lib/supabase/server";

// GET /api/pdf/season/1?lang=en&view=team → championship standings (riders or teams) as PDF.
export async function GET(request: Request, { params }: RouteContext<"/api/pdf/season/[seasonId]">) {
  const { seasonId: rawId } = await params;
  const search = new URL(request.url).searchParams;
  const langParam = search.get("lang") ?? "";
  const lang = hasLocale(langParam) ? langParam : defaultLocale;
  const seasonId = Number(rawId);
  if (!Number.isInteger(seasonId)) return new Response("Not found", { status: 404 });

  const data = await loadSeasonStandings(await createClient(), seasonId);
  if (!data) return new Response("Not found", { status: 404 });
  const view = search.get("view") === "team" ? "teams" : "riders";

  const pdf = await renderPdf(
    createElement(SeasonDocument, {
      lang,
      dict: getDictionary(lang),
      data,
      view,
      generatedAt: formatClock(new Date()),
    }) as unknown as ReactElement<DocumentProps>, // SeasonDocument renders a <Document> root
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="standings-${data.season.year}-${view}-${lang}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
