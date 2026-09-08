import type { DocumentRendererPort, DocumentRenderInput } from "@edaya/core";
import { DocumentRenderError } from "./errors";
import type { PdfRenderer } from "./ports/pdf-renderer";
import { renderDocument } from "./services/render-document";

export interface CreateDocumentRendererOptions {
  readonly pdfRenderer: PdfRenderer;
  readonly fetchImpl?: typeof fetch;
}

export function createDocumentRenderer(options: CreateDocumentRendererOptions): DocumentRendererPort {
  return {
    async render(input: DocumentRenderInput) {
      const result = await renderDocument({
        templateKey: input.templateKey,
        locale: input.locale,
        payload: input.payload,
        options: input.options,
      }, {
        pdfRenderer: options.pdfRenderer,
        ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      });

      if (result.kind === "failure") {
        throw new DocumentRenderError(result.code, result.message);
      }

      return {
        bytes: result.value.bytes,
        contentType: result.value.contentType,
        sha256: result.value.sha256,
        renderId: result.value.renderId,
      };
    },
  };
}
