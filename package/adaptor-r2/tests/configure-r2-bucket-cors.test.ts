import { describe, expect, it } from "bun:test";
import { buildBrowserUploadCorsOrigins } from "../src/configure-r2-bucket-cors";

describe("buildBrowserUploadCorsOrigins", () => {
  it("includes local dev defaults and merges TRUSTED_ORIGINS without duplicates", () => {
    expect(buildBrowserUploadCorsOrigins([
      "https://app.edaya.com",
      "http://localhost:5173",
    ])).toEqual([
      "http://localhost:5173",
      "http://localhost:4173",
      "https://app.edaya.com",
    ]);
  });
});
