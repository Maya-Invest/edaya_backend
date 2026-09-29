import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createLocalFileStorage } from "../src/local-file-storage";
import { createLocalFileObjectStore, resolveObjectPath } from "../src/object-store";
import { createLocalFileStorageApp } from "../src/server-app";
import { createLocalFileToken, verifyLocalFileToken } from "../src/tokens";

describe("local file tokens", () => {
  it("signs and verifies upload tokens", () => {
    const payload = {
      op: "upload" as const,
      sizeBytes: 3,
      key: "school-1/uploads/staff/staff-1/att-1/photo.jpg",
      contentType: "image/jpeg",
      exp: Math.floor(Date.now() / 1000) + 60,
    };
    const token = createLocalFileToken("secret", payload);
    expect(verifyLocalFileToken("secret", token)).toEqual(payload);
  });
});

describe("createLocalFileObjectStore", () => {
  it("resolves nested keys under the storage root", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "edaya-local-fs-"));
    const objectPath = resolveObjectPath(rootDir, "school-1/uploads/staff/staff-1/att-1/photo.jpg");
    expect(objectPath.startsWith(`${resolve(rootDir)}${sep}`)).toBe(true);
    rmSync(rootDir, { recursive: true, force: true });
  });

  it("retries missing objects but reports filesystem deletion failures", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "edaya-local-fs-delete-"));
    const store = createLocalFileObjectStore({ rootDir });
    try {
      await store.putObject({ key: "object.pdf", body: new Uint8Array([1]), contentType: "application/pdf" });
      await store.deleteObject("object.pdf");
      await store.deleteObject("object.pdf");
      expect(await store.headObject("object.pdf")).toBeNull();
      mkdirSync(store.resolvePath("directory.pdf"));
      await expect(store.deleteObject("directory.pdf")).rejects.toThrow("LOCAL_FILE_DELETE_FAILED");
      rmSync(store.resolvePath("directory.pdf"), { recursive: true });
      await expect(store.deleteObject("directory.pdf")).resolves.toBeUndefined();
    }
    finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

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

  it("round trips Unicode document keys through the internal HTTP transport", async () => {
    const storage = createLocalFileStorage({ baseUrl, rootDir, secret });
    const key = "school-1/generated/Certificat-de-scolarité-2026—2027-100%.pdf";
    const body = new TextEncoder().encode("%PDF-test");
    await storage.putObject({ key, body, contentType: "application/pdf" });
    const stored = await storage.readObject(key, { maxBytes: 100 });
    expect(stored?.body).toEqual(body);
    const download = await storage.createPresignedDownload(key, { fileName: "Certificat-école—2027.pdf" });
    const response = await fetch(download.downloadUrl);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("filename*=UTF-8''Certificat-%C3%A9cole%E2%80%942027.pdf");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);
    await storage.deleteObject(key);
    expect(await storage.headObject(key)).toBeNull();
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

  it("rejects signed uploads with a different actual byte count without storing an object", async () => {
    const storage = createLocalFileStorage({ baseUrl, rootDir, secret });
    for (const size of [2, 4]) {
      const key = `bounded-upload-${size}`;
      const upload = await storage.createPresignedUpload({ key, contentType: "image/jpeg", sizeBytes: 3 });
      const response = await fetch(upload.uploadUrl, { method: "PUT", headers: upload.headers, body: new Uint8Array(size) });
      expect(response.status).toBe(size > 3 ? 413 : 400);
      expect(await storage.headObject(key)).toBeNull();
    }
  });

  it("loads complete private objects with a required enforced byte bound", async () => {
    const storage = createLocalFileStorage({ baseUrl, rootDir, secret });
    await storage.putObject({ key: "bounded-asset", body: new Uint8Array([1, 2, 3]), contentType: "image/png" });
    await expect(storage.readObject("bounded-asset", { maxBytes: 3 })).resolves.toEqual({
      body: new Uint8Array([1, 2, 3]),
      sizeBytes: 3,
      contentType: "image/png",
    });
    await expect(storage.readObject("bounded-asset", { maxBytes: 2 })).rejects.toThrow("FILE_READ_LIMIT_EXCEEDED");
    await expect(storage.readObject("missing-asset", { maxBytes: 3 })).resolves.toBeNull();
    await expect(storage.readObject("missing-asset", { maxBytes: 0 })).rejects.toThrow("FILE_READ_LIMIT_INVALID");
    await expect(fetch(`${baseUrl}/internal/objects/content?key=bounded-asset&maxBytes=3`)).resolves.toMatchObject({ status: 401 });
    await expect(fetch(`${baseUrl}/internal/objects/content?key=bounded-asset`, {
      headers: { authorization: `Bearer ${secret}` },
    })).resolves.toMatchObject({ status: 400 });
    await expect(fetch(`${baseUrl}/internal/objects/content?key=../escape&maxBytes=3`, {
      headers: { authorization: `Bearer ${secret}` },
    })).resolves.toMatchObject({ status: 500 });
  });

  it("returns health status", async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("rejects upload and download requests without tokens", async () => {
    await expect(fetch(`${baseUrl}/upload`, { method: "PUT" })).resolves.toMatchObject({ status: 400 });
    await expect(fetch(`${baseUrl}/download`)).resolves.toMatchObject({ status: 400 });
  });

  it("rejects invalid upload tokens and content-type mismatches", async () => {
    await expect(fetch(`${baseUrl}/upload?token=invalid`, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: new Uint8Array([1]),
    })).resolves.toMatchObject({ status: 403 });

    const downloadToken = createLocalFileToken(secret, {
      op: "download",
      key: "school-1/uploads/staff/staff-1/att-1/photo.jpg",
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    await expect(fetch(`${baseUrl}/upload?token=${downloadToken}`, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: new Uint8Array([1]),
    })).resolves.toMatchObject({ status: 400 });
  });

  it("returns not found for missing download objects", async () => {
    const token = createLocalFileToken(secret, {
      op: "download",
      key: "school-1/uploads/missing/file.bin",
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    await expect(fetch(`${baseUrl}/download?token=${token}`)).resolves.toMatchObject({ status: 404 });
  });

  it("guards internal object routes with bearer auth", async () => {
    await expect(fetch(`${baseUrl}/internal/objects`, { method: "PUT" })).resolves.toMatchObject({ status: 401 });
    await expect(fetch(`${baseUrl}/internal/objects/metadata`)).resolves.toMatchObject({ status: 401 });
    await expect(fetch(`${baseUrl}/internal/objects`, { method: "DELETE" })).resolves.toMatchObject({ status: 401 });
  });

  it("supports internal metadata lookup and deletion", async () => {
    const key = "school-1/uploads/staff/staff-1/att-3/report.pdf";
    const authHeaders = {
      "authorization": `Bearer ${secret}`,
      "content-type": "application/pdf",
      "x-storage-key": key,
    };

    const putResponse = await fetch(`${baseUrl}/internal/objects`, {
      method: "PUT",
      headers: authHeaders,
      body: new Uint8Array([5, 6, 7]),
    });
    expect(putResponse.status).toBe(200);

    const metadataResponse = await fetch(`${baseUrl}/internal/objects/metadata?key=${encodeURIComponent(key)}`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(metadataResponse.status).toBe(200);
    await expect(metadataResponse.json()).resolves.toMatchObject({
      sizeBytes: 3,
      contentType: "application/pdf",
    });

    const deleteResponse = await fetch(`${baseUrl}/internal/objects?key=${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(deleteResponse.status).toBe(204);
  });
});
