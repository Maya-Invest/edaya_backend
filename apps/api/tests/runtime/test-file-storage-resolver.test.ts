import { describe, expect, it } from "bun:test";
import { resolveFileStorage } from "@/runtime/shared/adapters/file-storage";
import { createPgliteTestEnv } from "../support/pglite-env";

describe("resolveFileStorage", () => {
  it("uses local-fs on the local runtime regardless of R2 env", async () => {
    const storage = resolveFileStorage(createPgliteTestEnv({
      RUNTIME: "local",
      DATABASE_URL: "pglite:.data/school",
      LOG_LEVEL: "info",
      R2_BUCKET_NAME: "edaya-files-dev",
      R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
    }));

    const upload = await storage.createPresignedUpload({
      key: "school-1/uploads/staff/staff-1/att-1/photo.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1,
    });
    expect(upload.uploadUrl).toContain("/upload?token=");
    expect(upload.uploadUrl).not.toStartWith("memory://");
  });

  it("uses in-memory storage on the in-memory runtime regardless of R2 env", async () => {
    const storage = resolveFileStorage(createPgliteTestEnv({
      R2_BUCKET_NAME: "edaya-files-dev",
      R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
    }));

    const upload = await storage.createPresignedUpload({
      key: "school-1/uploads/staff/staff-1/att-1/photo.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1,
    });
    expect(upload.uploadUrl).toStartWith("memory://");
  });

  it("requires R2 on the worker runtime when not silent", () => {
    expect(() => resolveFileStorage(createPgliteTestEnv({
      RUNTIME: "worker",
      DATABASE_URL: "postgres://worker/edaya",
      LOG_LEVEL: "info",
    }))).toThrow(/RUNTIME=worker requires R2/);
  });

  it("uses R2 on the worker runtime when configured", async () => {
    const storage = resolveFileStorage(createPgliteTestEnv({
      RUNTIME: "worker",
      DATABASE_URL: "postgres://worker/edaya",
      LOG_LEVEL: "info",
      R2_BUCKET_NAME: "edaya-files-dev",
      R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
    }));

    const upload = await storage.createPresignedUpload({
      key: "school-1/uploads/staff/staff-1/att-1/photo.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1,
    });
    expect(upload.uploadUrl).toContain("r2.cloudflarestorage.com");
  });
});
