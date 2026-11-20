import type { PdfRenderer, PdfRenderInput } from "../ports/pdf-renderer";

function paperSize(paper: PdfRenderInput["paper"]): string {
  return paper === "Letter" ? "Letter" : "A4";
}

/** Chromium HTML→PDF via Gotenberg. */
export function createGotenbergPdfRenderer(gotenbergUrl: string): PdfRenderer {
  const baseUrl = gotenbergUrl.replace(/\/$/, "");

  return {
    async render(input: PdfRenderInput): Promise<Uint8Array> {
      const form = new FormData();
      form.append("files", new Blob([input.html], { type: "text/html" }), "index.html");
      form.append("paperWidth", paperSize(input.paper) === "Letter" ? "8.5" : "8.27");
      form.append("paperHeight", paperSize(input.paper) === "Letter" ? "11" : "11.7");
      form.append("landscape", input.orientation === "landscape" ? "true" : "false");
      form.append("printBackground", "true");
      form.append("marginTop", "0");
      form.append("marginBottom", "0");
      form.append("marginLeft", "0");
      form.append("marginRight", "0");

      const response = await fetch(`${baseUrl}/forms/chromium/convert/html`, {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        throw new Error(`Gotenberg render failed: ${response.status}`);
      }

      return new Uint8Array(await response.arrayBuffer());
    },
  };
}
