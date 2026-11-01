import { Buffer } from "node:buffer";
import { expect, test } from "bun:test";
import { createChromePdfRenderer, detectChromeExecutable } from "../src/adapters/chrome-pdf-renderer";

test("Chrome prints HTML when a binary is available", async () => {
  const chromePath = detectChromeExecutable();
  if (!chromePath) {
    return;
  }
  const bytes = await createChromePdfRenderer(chromePath).render({
    html: "<html><body><h1>Bulletin Koné</h1></body></html>",
    paper: "A4",
    orientation: "portrait",
  });
  expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
  expect(bytes.byteLength).toBeGreaterThan(2048);
}, 45_000);
