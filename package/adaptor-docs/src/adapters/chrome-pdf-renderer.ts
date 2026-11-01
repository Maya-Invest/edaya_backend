import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import type { PdfRenderer, PdfRenderInput } from "../ports/pdf-renderer";

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const PRINT_TIMEOUT_MS = 20_000;
const PDF_POLL_MS = 100;

function playwrightHeadlessShells(): string[] {
  const found: string[] = [];
  const roots = [
    join(homedir(), "Library/Caches/ms-playwright"),
    join(homedir(), ".cache/ms-playwright"),
  ];
  for (const root of roots) {
    if (!existsSync(root)) {
      continue;
    }
    let names: string[] = [];
    try {
      names = readdirSync(root);
    }
    catch {
      continue;
    }
    for (const name of names) {
      if (!name.startsWith("chromium_headless_shell-")) {
        continue;
      }
      const mac = join(root, name, "chrome-mac", "headless_shell");
      const linux = join(root, name, "chrome-headless-shell", "chrome-headless-shell");
      if (existsSync(mac)) {
        found.push(mac);
      }
      if (existsSync(linux)) {
        found.push(linux);
      }
    }
  }
  return found;
}

export function detectChromeExecutable(explicitPath?: string): string | undefined {
  if (explicitPath !== undefined) {
    const trimmed = explicitPath.trim();
    return trimmed.length > 0 && existsSync(trimmed) ? trimmed : undefined;
  }
  return [...playwrightHeadlessShells(), ...CHROME_CANDIDATES].find(candidate => existsSync(candidate));
}

/** Keep template `@page` margins. Only set paper size when the HTML has no page box. */
export function prepareChromePrintHtml(
  html: string,
  paper: PdfRenderInput["paper"],
  orientation: PdfRenderInput["orientation"],
): string {
  if (/@page\b/i.test(html)) {
    return html;
  }
  const css = `@page{size:${paper} ${orientation}}`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `<style>${css}</style></head>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`;
}

function killChrome(child: ChildProcess): void {
  if (!child.pid || child.exitCode !== null) {
    return;
  }
  try {
    if (process.platform === "win32") {
      child.kill("SIGKILL");
      return;
    }
    process.kill(-child.pid, "SIGKILL");
  }
  catch {
    try {
      child.kill("SIGKILL");
    }
    catch {
      // already gone
    }
  }
}

function isCompletePdf(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 8 || bytes.subarray(0, 5).toString() !== "%PDF-") {
    return false;
  }
  const tail = bytes.subarray(Math.max(0, bytes.byteLength - 64)).toString();
  return tail.includes("%%EOF");
}

async function waitForPdf(pdfPath: string, timeoutMs: number): Promise<Uint8Array> {
  const deadline = Date.now() + timeoutMs;
  let lastSize = -1;
  let stableTicks = 0;
  while (Date.now() < deadline) {
    try {
      const info = await stat(pdfPath);
      if (info.size >= 8) {
        const bytes = await readFile(pdfPath);
        if (isCompletePdf(bytes)) {
          if (bytes.byteLength === lastSize) {
            stableTicks += 1;
            if (stableTicks >= 2) {
              return new Uint8Array(bytes);
            }
          }
          else {
            lastSize = bytes.byteLength;
            stableTicks = 0;
          }
        }
      }
    }
    catch {
      // Chrome has not created the file yet
    }
    await new Promise(resolve => setTimeout(resolve, PDF_POLL_MS));
  }
  throw new Error("Chrome PDF timed out");
}

function spawnChrome(executablePath: string, args: string[]): ChildProcess {
  return spawn(executablePath, args, {
    detached: process.platform !== "win32",
    stdio: "ignore",
  });
}

/** Headless Chrome/Chromium HTML→PDF for local development without Gotenberg. */
export function createChromePdfRenderer(executablePath: string): PdfRenderer {
  return {
    async render(input: PdfRenderInput): Promise<Uint8Array> {
      const dir = await mkdtemp(join(tmpdir(), "edaya-chrome-pdf-"));
      const htmlPath = join(dir, "index.html");
      const pdfPath = join(dir, "document.pdf");
      let child: ChildProcess | undefined;
      try {
        await writeFile(htmlPath, prepareChromePrintHtml(input.html, input.paper, input.orientation), "utf8");
        const htmlUrl = pathToFileURL(htmlPath).href;
        child = spawnChrome(executablePath, [
          "--headless=new",
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--no-sandbox",
          "--no-first-run",
          "--no-default-browser-check",
          "--allow-file-access-from-files",
          "--no-pdf-header-footer",
          `--user-data-dir=${join(dir, "profile")}`,
          `--print-to-pdf=${pdfPath}`,
          htmlUrl,
        ]);
        return await waitForPdf(pdfPath, PRINT_TIMEOUT_MS);
      }
      finally {
        if (child) {
          killChrome(child);
        }
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}
