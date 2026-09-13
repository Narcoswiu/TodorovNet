import type { DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { renderPdf } from "@/lib/pdf/render";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { formatClock } from "@/lib/format";
import { ResultsDocument, type PublicationInfo, type Snapshot } from "@/lib/pdf/documents";
import { createClient } from "@/lib/supabase/server";

// GET /api/pdf/publication/42?lang=en → the frozen results of publication 42 as PDF.
export async function GET(request: Request, { params }: RouteContext<"/api/pdf/publication/[id]">) {
  const { id } = await params;
  const langParam = new URL(request.url).searchParams.get("lang") ?? "";
  const lang = hasLocale(langParam) ? langParam : defaultLocale;
  const publicationId = Number(id);
  if (!Number.isInteger(publicationId)) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: publication } = await supabase
    .from("publications")
    .select("id, state, version, published_at, protest_deadline_at, published_by_name, snapshot")
    .eq("id", publicationId)
    .maybeSingle();
  if (!publication?.snapshot) return new Response("Not found", { status: 404 });

  const snapshot = publication.snapshot as unknown as Snapshot;
  const info: PublicationInfo = {
    state: publication.state,
    version: publication.version,
    published_at: publication.published_at,
    protest_deadline_at: publication.protest_deadline_at,
    published_by_name: publication.published_by_name,
  };

  const pdf = await renderPdf(
    createElement(ResultsDocument, {
      lang,
      dict: getDictionary(lang),
      snapshot,
      publication: info,
      generatedAt: formatClock(new Date()),
    }) as unknown as ReactElement<DocumentProps>, // ResultsDocument renders a <Document> root
  );

  const fileName = `${snapshot.kind}-v${publication.version}-${lang}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      // A publication never changes, so its PDF can be cached.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
