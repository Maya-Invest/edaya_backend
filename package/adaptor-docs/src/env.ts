import type { BrowserRunBinding } from "./adapters/browser-run-pdf-renderer";

export interface DocsRendererEnv {
  RUNTIME?: "in-memory" | "local" | "worker" | string;
  GOTENBERG_URL?: string;
  BROWSER?: BrowserRunBinding;
}
