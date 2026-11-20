import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { describe, expect, it } from "bun:test";
import { createLocalFileObjectStore, resolveObjectPath } from "../src/object-store";
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
