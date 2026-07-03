import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalFileStorage } from "../src/local-file-storage";
import { createLocalFileObjectStore } from "../src/object-store";
import { createLocalFileStorageApp } from "../src/server-app";
import { createLocalFileToken, verifyLocalFileToken } from "../src/tokens";

describe("local file tokens", () => {
  it("signs and verifies upload tokens", () => {
    const payload = {
      op: "upload" as const,
      key: "school-1/uploads/staff/staff-1/att-1/photo.jpg",
      contentType: "image/jpeg",
      exp: Math.floor(Date.now() / 1000) + 60,
    };
    const token = createLocalFileToken("secret", payload);
    expect(verifyLocalFileToken("secret", token)).toEqual(payload);
  });
});

describe("createLocalFileObjectStore", () => {
  it("rejects path traversal keys", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "edaya-local-fs-"));
    const store = createLocalFileObjectStore({ rootDir });
    await expect(store.putObject({
      key: "../escape.txt",
      body: new Uint8Array([1]),
      contentType: "text/plain",
    })).rejects.toThrow("Invalid storage key");
    rmSync(rootDir, { recursive: true, force: true });
  });
});

describe("createLocalFileStorageApp", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "edaya-local-fs-app-"));
  const secret = "test-secret";
  const port = 0;
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl = "";

  beforeAll(() => {
    const app = createLocalFileStorageApp({
      baseUrl: "http://127.0.0.1",
      rootDir,
      secret,
      allowedOrigins: ["http://localhost:5173"],
    });
    server = Bun.serve({ port, hostname: "127.0.0.1", fetch: app.fetch });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(() => {
    server.stop();
    rmSync(rootDir, { recursive: true, force: true });
  });

  it("supports presigned upload and download", async () => {
    const storage = createLocalFileStorage({ baseUrl, rootDir, secret });
    const key = "school-1/uploads/staff/staff-1/att-1/photo.jpg";
    const body = new Uint8Array([9, 8, 7]);

    const upload = await storage.createPresignedUpload({
      key,
      contentType: "image/jpeg",
      sizeBytes: body.byteLength,
    });

    const uploadResponse = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: upload.headers,
      body,
    });
    expect(uploadResponse.ok).toBe(true);

    const head = await storage.headObject(key);
    expect(head?.sizeBytes).toBe(3);
    expect(head?.contentType).toBe("image/jpeg");

    const download = await storage.createPresignedDownload(key, { fileName: "photo.jpg" });
    const downloadResponse = await fetch(download.downloadUrl);
    expect(downloadResponse.ok).toBe(true);
    expect(new Uint8Array(await downloadResponse.arrayBuffer())).toEqual(body);
  });

  it("supports internal putObject", async () => {
    const storage = createLocalFileStorage({ baseUrl, rootDir, secret });
    const key = "school-1/uploads/student/student-2/att-2/file.pdf";
    await storage.putObject({
      key,
      body: new Uint8Array([1, 2, 3, 4]),
      contentType: "application/pdf",
    });

    const head = await storage.headObject(key);
    expect(head?.sizeBytes).toBe(4);
    expect(head?.contentType).toBe("application/pdf");
  });
});
