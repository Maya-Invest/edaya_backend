import type { BrowserRunBinding } from "./adapters/browser-run-pdf-renderer";
import { createBrowserRunPdfRenderer } from "./adapters/browser-run-pdf-renderer";
import { createChromePdfRenderer, detectChromeExecutable } from "./adapters/chrome-pdf-renderer";
import { createGotenbergPdfRenderer } from "./adapters/gotenberg-pdf-renderer";
import { createStubPdfRenderer } from "./adapters/stub-pdf-renderer";
import type { DocsRendererEnv } from "./env";
import type { PdfRenderer } from "./ports/pdf-renderer";

export type ResolvedPdfRendererKind = "browser" | "gotenberg" | "chrome" | "stub";

export interface ResolvedPdfRenderer {
  kind: ResolvedPdfRendererKind;
  renderer: PdfRenderer;
}

function isBrowserRunBinding(value: unknown): value is BrowserRunBinding {
  return Boolean(value && typeof value === "object" && "quickAction" in value
    && typeof (value as { quickAction?: unknown }).quickAction === "function");
}

export function resolvePdfRenderer(env: DocsRendererEnv): ResolvedPdfRenderer | undefined {
  if (env.RUNTIME === "in-memory") {
    return undefined;
  }

  const browser = env.BROWSER;
  if (env.RUNTIME === "worker" && isBrowserRunBinding(browser)) {
    return { kind: "browser", renderer: createBrowserRunPdfRenderer(browser) };
  }

  const gotenbergUrl = env.GOTENBERG_URL?.trim();
  if (gotenbergUrl) {
    return { kind: "gotenberg", renderer: createGotenbergPdfRenderer(gotenbergUrl) };
  }

  if (env.RUNTIME === "local") {
    const chromePath = detectChromeExecutable(env.CHROME_PATH);
    if (chromePath) {
      return { kind: "chrome", renderer: createChromePdfRenderer(chromePath) };
    }
    return { kind: "stub", renderer: createStubPdfRenderer() };
  }

  return undefined;
}
