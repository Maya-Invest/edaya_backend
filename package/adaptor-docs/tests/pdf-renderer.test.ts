import { Buffer } from "node:buffer";
import { describe, expect, test } from "bun:test";
import { createBrowserRunPdfRenderer } from "../src/adapters/browser-run-pdf-renderer";
import { createGotenbergPdfRenderer } from "../src/adapters/gotenberg-pdf-renderer";
import { createStubPdfRenderer } from "../src/adapters/stub-pdf-renderer";
import { resolvePdfRenderer } from "../src/resolve";

describe("resolvePdfRenderer", () => {
  test("never selects Gotenberg or Browser Run on in-memory", () => {
    expect(resolvePdfRenderer({
      RUNTIME: "in-memory",
      GOTENBERG_URL: "http://localhost:3000",
      BROWSER: { quickAction: async () => new Response("%PDF") },
    })).toBeUndefined();
  });

  test("prefers Browser Run on the worker when BROWSER is bound", () => {
    const resolved = resolvePdfRenderer({
      RUNTIME: "worker",
      GOTENBERG_URL: "http://localhost:3000",
      BROWSER: { quickAction: async () => new Response("%PDF") },
    });
    expect(resolved?.kind).toBe("browser");
  });

  test("uses Gotenberg on worker without BROWSER", () => {
    const resolved = resolvePdfRenderer({
      RUNTIME: "worker",
      GOTENBERG_URL: "http://localhost:3000",
    });
    expect(resolved?.kind).toBe("gotenberg");
  });

  test("is not configured on worker without BROWSER or Gotenberg", () => {
    expect(resolvePdfRenderer({ RUNTIME: "worker" })).toBeUndefined();
  });

  test("uses Gotenberg on local when GOTENBERG_URL is set", () => {
    const resolved = resolvePdfRenderer({
      RUNTIME: "local",
      GOTENBERG_URL: "http://localhost:3000",
    });
    expect(resolved?.kind).toBe("gotenberg");
  });

  test("uses stub on local without GOTENBERG_URL", () => {
    const resolved = resolvePdfRenderer({ RUNTIME: "local" });
    expect(resolved?.kind).toBe("stub");
  });
});

describe("pdf renderers", () => {
  test("stub returns a tiny valid PDF", async () => {
    const bytes = await createStubPdfRenderer().render({
      html: "<html></html>",
      paper: "A4",
      orientation: "portrait",
    });
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.byteLength).toBeLessThan(2048);
  });

  test("Browser Run posts HTML through quickAction", async () => {
    let capturedHtml: string | undefined;
    const renderer = createBrowserRunPdfRenderer({
      quickAction: async (_action, options) => {
        capturedHtml = options.html;
        return new Response("%PDF-browser", { status: 200 });
      },
    });
    const bytes = await renderer.render({
      html: "<p>bulletin</p>",
      paper: "A4",
      orientation: "portrait",
    });
    expect(capturedHtml).toBe("<p>bulletin</p>");
    expect(Buffer.from(bytes).toString()).toBe("%PDF-browser");
  });

  test("Gotenberg posts HTML to convert/html", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      expect(String(input)).toBe("http://localhost:3000/forms/chromium/convert/html");
      return new Response("%PDF-gotenberg", { status: 200 });
    }) as typeof fetch;
    try {
      const renderer = createGotenbergPdfRenderer("http://localhost:3000/");
      const bytes = await renderer.render({
        html: "<p>bulletin</p>",
        paper: "A4",
        orientation: "portrait",
      });
      expect(Buffer.from(bytes).toString()).toBe("%PDF-gotenberg");
    }
    finally {
      globalThis.fetch = originalFetch;
    }
  });
});
