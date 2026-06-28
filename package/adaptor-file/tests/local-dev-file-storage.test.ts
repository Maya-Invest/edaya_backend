import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createDevStorageToken,
  createLocalDevFileStorage,
  isDevStorageTokenExpired,
  readLocalDevObject,
  verifyDevStorageToken,
} from "../src";

describe("createLocalDevFileStorage", () => {
  let rootDir: string;

  beforeAll(async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), "edaya-dev-storage-"));
  });

  afterAll(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it("stores objects on disk and issues signed upload URLs", async () => {
    const storage = createLocalDevFileStorage({
      rootDir,
      publicBaseUrl: "http://localhost:9999",
      signingSecret: "dev-secret",
    });

    const presigned = await storage.createPresignedUpload({
      key: "school-1/uploads/student/student-1/att-1/photo.jpg",
      contentType: "image/jpeg",
      sizeBytes: 4,
    });

    expect(presigned.uploadUrl).toContain("/core/dev/files/upload");
    expect(presigned.uploadUrl).toContain("sig=");

    await storage.putObject({
      key: "school-1/uploads/student/student-1/att-1/photo.jpg",
      body: new Uint8Array([1, 2, 3, 4]),
      contentType: "image/jpeg",
    });

    const head = await storage.headObject("school-1/uploads/student/student-1/att-1/photo.jpg");
    expect(head?.sizeBytes).toBe(4);
    expect(head?.contentType).toBe("image/jpeg");
  });

  it("issues signed download URLs and deletes objects", async () => {
    const storage = createLocalDevFileStorage({
      rootDir,
      publicBaseUrl: "http://localhost:9999",
      signingSecret: "dev-secret",
    });
    const key = "school-1/uploads/incident/incident-1/att-2/report.pdf";

    await storage.putObject({
      key,
      body: new Uint8Array([9, 8, 7]),
      contentType: "application/pdf",
    });

    const download = await storage.createPresignedDownload(key, {
      fileName: "report.pdf",
      disposition: "attachment",
    });
    expect(download.downloadUrl).toContain("/core/dev/files/download");
    expect(download.downloadUrl).toContain("fileName=report.pdf");

    const inlineDownload = await storage.createPresignedDownload(key, {
      fileName: "photo.jpg",
      disposition: "inline",
    });
    expect(inlineDownload.downloadUrl).toContain("disposition=inline");

    await storage.deleteObject(key);
    expect(await readLocalDevObject(rootDir, key)).toBeNull();
  });
});

describe("dev storage token", () => {
  it("verifies signed payloads and expiry", () => {
    const expiresAt = Date.now() + 60_000;
    const token = createDevStorageToken("secret", {
      operation: "upload",
      key: "school/file.jpg",
      expiresAt,
      contentType: "image/jpeg",
    });

    expect(verifyDevStorageToken("secret", {
      operation: "upload",
      key: "school/file.jpg",
      expiresAt,
      contentType: "image/jpeg",
    }, token)).toBe(true);

    expect(isDevStorageTokenExpired(expiresAt, expiresAt + 1)).toBe(true);
  });
});
