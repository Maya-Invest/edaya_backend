import { createLocalDevFileStorage } from "@/runtime/shared/adapters/local-dev-file-storage";
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("bounded local development storage", () => {
  test("enforces the same bound for memory and disk without exposing mutable memory", async () => {
    const persistDir = await mkdtemp(join(tmpdir(), "edaya-bounded-files-"));
    try {
      for (const options of [{}, { persistDir }]) {
        const storage = createLocalDevFileStorage("http://localhost:9999", options);
        await storage.putObject({ key: "school/asset", body: new Uint8Array([1, 2, 3]), contentType: "image/png" });
        await expect(storage.readObject("school/asset", { maxBytes: 3 })).resolves.toEqual({
          body: new Uint8Array([1, 2, 3]),
          sizeBytes: 3,
          contentType: "image/png",
        });
        await expect(storage.readObject("school/asset", { maxBytes: 2 })).rejects.toThrow("FILE_READ_LIMIT_EXCEEDED");
        await expect(storage.readObject("missing", { maxBytes: 3 })).resolves.toBeNull();
      }
      const disk = createLocalDevFileStorage("http://localhost:9999", { persistDir });
      await expect(disk.readObject("../escape", { maxBytes: 3 })).rejects.toThrow("Invalid storage key");
    }
    finally {
      await rm(persistDir, { recursive: true, force: true });
    }
  });
});
