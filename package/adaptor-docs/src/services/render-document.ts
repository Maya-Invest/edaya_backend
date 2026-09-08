import { createHash, randomUUID } from "node:crypto";
import type { PdfRenderer } from "../ports/pdf-renderer";
import {
  DOCUMENT_RENDERING_FAILURES,

} from "../types";
import type { DocumentRenderingFailureCode, RenderDocumentRequest, RenderDocumentResult } from "../types";
import { getTemplateDefinition } from "../templates/registry";
import { overlaySignatures } from "./overlay-signatures";

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function createRenderId(): string {
  return `rnd_${randomUUID().replaceAll("-", "")}`;
}

export interface RenderDocumentDependencies {
  readonly pdfRenderer: PdfRenderer;
  readonly fetchImpl?: typeof fetch;
}

export async function renderDocument(
  request: RenderDocumentRequest,
  dependencies: RenderDocumentDependencies,
): Promise<RenderDocumentResult> {
  const template = getTemplateDefinition(request.templateKey);
  if (!template) {
    return failure(DOCUMENT_RENDERING_FAILURES.templateNotFound, `Unknown template: ${request.templateKey}`);
  }

  const validationError = template.validatePayload(request.payload);
  if (validationError) {
    return failure(DOCUMENT_RENDERING_FAILURES.invalidPayload, validationError);
  }

  let bytes: Uint8Array;
  try {
    const html = template.compileHtml(request.locale, request.payload);
    bytes = await dependencies.pdfRenderer.render({
      html,
      paper: request.options?.paper ?? "A4",
      orientation: request.options?.orientation ?? "portrait",
    });
    const signatures = request.options?.signatures ?? [];
    if (signatures.length > 0) {
      bytes = await overlaySignatures(bytes, signatures, {
        ...(dependencies.fetchImpl === undefined ? {} : { fetchImpl: dependencies.fetchImpl }),
      });
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : "Render failed";
    return failure(DOCUMENT_RENDERING_FAILURES.unavailable, message);
  }

  return {
    kind: "success",
    value: {
      renderId: createRenderId(),
      contentType: "application/pdf",
      sha256: sha256Hex(bytes),
      bytes,
    },
  };
}

function failure(code: DocumentRenderingFailureCode, message: string): RenderDocumentResult {
  return { kind: "failure", code, message };
}
