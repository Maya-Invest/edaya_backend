import type { PdfRenderer } from "../ports/pdf-renderer";
import { createChromePdfRenderer, detectChromeExecutable } from "./chrome-pdf-renderer";
import { createGotenbergPdfRenderer } from "./gotenberg-pdf-renderer";
import { createStubPdfRenderer } from "./stub-pdf-renderer";

export function createPdfRenderer(gotenbergUrl?: string): PdfRenderer {
  if (gotenbergUrl && gotenbergUrl.length > 0) {
    return createGotenbergPdfRenderer(gotenbergUrl);
  }
  const chromePath = detectChromeExecutable();
  if (chromePath) {
    return createChromePdfRenderer(chromePath);
  }
  return createStubPdfRenderer();
}
