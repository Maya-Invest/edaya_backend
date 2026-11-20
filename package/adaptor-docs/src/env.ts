import type { BrowserRunBinding } from "./adapters/browser-run-pdf-renderer";

export interface DocsRendererEnv {
  RUNTIME?: "in-memory" | "local" | "worker" | string;
  GOTENBERG_URL?: string;
  /** Absolute Chrome/Chromium binary. Blank disables local Chrome PDF and keeps the stub. */
  CHROME_PATH?: string;
  BROWSER?: BrowserRunBinding;
}
