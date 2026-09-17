import type { DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { manualBg } from "@/i18n/manual/bg";
import { manualEn } from "@/i18n/manual/en";
import { ManualDocument } from "@/lib/pdf/manual-document";
import { getViewer } from "@/lib/auth";
import { renderPdf } from "@/lib/pdf/render";

// GET /api/pdf/manual?lang=bg → the officials' manual as a printable booklet.
export async function GET(request: Request) {
  const langParam = new URL(request.url).searchParams.get("lang") ?? "";
  const lang = hasLocale(langParam) ? langParam : defaultLocale;
  const manual = lang === "en" ? manualEn : manualBg;

  // Officials only, like the manual page itself.
  if (!(await getViewer())) return new Response("Forbidden", { status: 403 });

  const pdf = await renderPdf(
    createElement(ManualDocument, {
      lang,
      manual,
      generatedAt: new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "bg-BG", { dateStyle: "long" }).format(new Date()),
    }) as unknown as ReactElement<DocumentProps>, // ManualDocument renders a <Document> root
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="todorovnet-manual-${lang}.pdf"`,
      "Cache-Control": "private, max-age=600",
    },
  });
}
