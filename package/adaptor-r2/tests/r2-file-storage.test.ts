import { describe, expect, it } from "bun:test";
import { createR2FileStorage, resolveR2Endpoint } from "../src/r2-file-storage";

describe("createR2FileStorage", () => {
  it("is exported and constructible with config shape", () => {
    expect(typeof createR2FileStorage).toBe("function");
  });

  it("resolves the default endpoint from account id", () => {
    expect(resolveR2Endpoint({ accountId: "test-account-id" }))
      .toBe("https://test-account-id.r2.cloudflarestorage.com");
  });

  it("uses an explicit jurisdiction-specific endpoint", () => {
    expect(resolveR2Endpoint({
      accountId: "ignored-for-endpoint",
      endpoint: "https://ca013c820d015639e8769dc09e2566ec.r2.cloudflarestorage.com/",
    })).toBe("https://ca013c820d015639e8769dc09e2566ec.r2.cloudflarestorage.com");
  });

  it("prefers an explicit endpoint over account id", () => {
    expect(resolveR2Endpoint({
      accountId: "dashboard-account-id",
      endpoint: "https://ca013c820d015639e8769dc09e2566ec.r2.cloudflarestorage.com",
    })).toBe("https://ca013c820d015639e8769dc09e2566ec.r2.cloudflarestorage.com");
  });

  it("mints presigned upload URLs without flexible checksum query params", async () => {
    const storage = createR2FileStorage({
      accountId: "test-account-id",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      bucketName: "edaya-files-dev",
    });

    const presigned = await storage.createPresignedUpload({
      key: "school/uploads/staff/st1/att-1/profile.jpg",
      contentType: "image/jpeg",
      sizeBytes: 128,
      expiresInSeconds: 60,
    });

    expect(presigned.uploadUrl).toContain("r2.cloudflarestorage.com");
    expect(presigned.uploadUrl).toContain("/edaya-files-dev/");
    expect(presigned.uploadUrl).not.toContain("x-amz-sdk-checksum-algorithm");
    expect(presigned.headers).toEqual({ "Content-Type": "image/jpeg" });
  });

  it("mints presigned upload URLs against an explicit endpoint", async () => {
    const storage = createR2FileStorage({
      accountId: "test-account-id",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      bucketName: "edaya-files-dev",
      endpoint: "https://ca013c820d015639e8769dc09e2566ec.r2.cloudflarestorage.com",
    });

    const presigned = await storage.createPresignedUpload({
      key: "school/uploads/staff/st1/att-1/profile.jpg",
      contentType: "image/jpeg",
      sizeBytes: 128,
      expiresInSeconds: 60,
    });

    expect(presigned.uploadUrl).toContain("https://ca013c820d015639e8769dc09e2566ec.r2.cloudflarestorage.com/edaya-files-dev/");
  });
});
