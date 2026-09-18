import { createDocumentRenderer, resolvePdfRenderer } from "@edaya/adaptor-docs";
import type { DocumentRendererPort, LoggerPort } from "@edaya/core";
import type { Environment } from "@/runtime/shared/env/schema";

export function isDocumentRendererConfigured(env: Environment | undefined): boolean {
  if (!env || env.LOG_LEVEL === "silent" || env.RUNTIME === "in-memory") {
    return false;
  }
  return resolvePdfRenderer(env) !== undefined;
}

export function resolveDocumentRenderer(
  env: Environment | undefined,
  logger?: LoggerPort,
): DocumentRendererPort | undefined {
  if (!isDocumentRendererConfigured(env) || !env) {
    return undefined;
  }

  const resolved = resolvePdfRenderer(env);
  if (!resolved) {
    return undefined;
  }

  if (resolved.kind === "stub") {
    logger?.info({}, "document renderer using stub PDF; set GOTENBERG_URL or install Chrome for real PDFs");
  }
  else if (resolved.kind === "chrome") {
    logger?.info({}, "document renderer using local Chrome print-to-pdf");
  }

  return createDocumentRenderer({ pdfRenderer: resolved.renderer });
}
