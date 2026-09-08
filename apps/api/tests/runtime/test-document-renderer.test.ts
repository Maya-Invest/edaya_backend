import { describe, expect, it } from "bun:test";
import {
  isDocumentRendererConfigured,
  resolveDocumentRenderer,
} from "@/runtime/shared/adapters/document-renderer";
import { createPgliteTestEnv } from "../support/pglite-env";

describe("isDocumentRendererConfigured", () => {
  it("is false on the in-memory runtime", () => {
    expect(isDocumentRendererConfigured(createPgliteTestEnv({
      GOTENBERG_URL: "http://localhost:3000",
    }))).toBe(false);
  });

  it("is false when LOG_LEVEL is silent", () => {
    expect(isDocumentRendererConfigured(createPgliteTestEnv({
      RUNTIME: "local",
      DATABASE_URL: "pglite:.data/school",
      LOG_LEVEL: "silent",
    }))).toBe(false);
  });

  it("is true on local when not silent", () => {
    expect(isDocumentRendererConfigured(createPgliteTestEnv({
      RUNTIME: "local",
      DATABASE_URL: "pglite:.data/school",
      LOG_LEVEL: "info",
    }))).toBe(true);
  });

  it("is false on worker without BROWSER or Gotenberg", () => {
    expect(isDocumentRendererConfigured(createPgliteTestEnv({
      RUNTIME: "worker",
      DATABASE_URL: "postgres://localhost/edaya",
      LOG_LEVEL: "info",
    }))).toBe(false);
  });
});

describe("resolveDocumentRenderer", () => {
  it("returns undefined on the in-memory runtime", () => {
    expect(resolveDocumentRenderer(createPgliteTestEnv({
      GOTENBERG_URL: "http://localhost:3000",
    }))).toBeUndefined();
  });

  it("returns a renderer on local", () => {
    expect(resolveDocumentRenderer(createPgliteTestEnv({
      RUNTIME: "local",
      DATABASE_URL: "pglite:.data/school",
      LOG_LEVEL: "info",
    }))).toBeDefined();
  });
});
