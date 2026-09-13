import { Font, renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";

// react-pdf keeps the opened font between documents in the same server process. Noto Sans draws the
// Latin "A" and the Cyrillic "А" with one shared glyph, and after a Bulgarian document the next English
// one silently lost its Latin "A" ("leksandar"). Re-opening the font for every document avoids that.
// Renders run one at a time so a font is never re-opened under a document that is still rendering.

type FontSourceState = { data: unknown; loadResultPromise: unknown };

function reopenFonts(family: string) {
  const families = Font.getRegisteredFonts() as unknown as Record<string, { sources: FontSourceState[] } | undefined>;
  for (const source of families[family]?.sources ?? []) {
    source.data = null;
    source.loadResultPromise = null;
  }
}

let queue: Promise<unknown> = Promise.resolve();

export function renderPdf(document: ReactElement<DocumentProps>): Promise<Buffer> {
  const run = queue.then(() => {
    reopenFonts("Noto Sans");
    return renderToBuffer(document);
  });
  queue = run.catch(() => undefined);
  return run;
}
