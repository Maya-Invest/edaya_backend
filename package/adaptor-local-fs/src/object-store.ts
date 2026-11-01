import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { assertStorageReadLimit, readBoundedStorageBody } from "@edaya/core";

export interface LocalFileObjectStoreConfig {
  rootDir: string;
}

interface StoredObjectMetadata {
  contentType: string;
}

function metadataPath(objectPath: string): string {
  return `${objectPath}.meta.json`;
}

export function resolveObjectPath(rootDir: string, key: string): string {
  const normalizedKey = key.replace(/^\/+/, "");
  if (!normalizedKey || normalizedKey.includes("..")) {
    throw new Error("Invalid storage key");
  }

  const root = resolve(rootDir);
  const objectPath = resolve(root, normalizedKey);
  if (objectPath !== root && !objectPath.startsWith(`${root}${sep}`)) {
    throw new Error("Invalid storage key");
  }

  return objectPath;
}

export function createLocalFileObjectStore(config: LocalFileObjectStoreConfig): LocalFileObjectStore {
  const rootDir = resolve(config.rootDir);

  async function ensureParentDirectory(objectPath: string): Promise<void> {
    await mkdir(dirname(objectPath), { recursive: true });
  }

  return {
    rootDir,
    async putObject(input: { key: string; body: Uint8Array; contentType: string }): Promise<{ sizeBytes: number }> {
      const objectPath = resolveObjectPath(rootDir, input.key);
      await ensureParentDirectory(objectPath);
      await writeFile(objectPath, input.body);
      const metadata: StoredObjectMetadata = { contentType: input.contentType };
      await writeFile(metadataPath(objectPath), JSON.stringify(metadata));
      return { sizeBytes: input.body.byteLength };
    },
    async headObject(key: string): Promise<{ sizeBytes: number; contentType?: string } | null> {
      const objectPath = resolveObjectPath(rootDir, key);
      try {
        const fileStat = await stat(objectPath);
        let contentType: string | undefined;
        try {
          const metadata = JSON.parse(await readFile(metadataPath(objectPath), "utf8")) as StoredObjectMetadata;
          contentType = metadata.contentType;
        }
        catch {
          contentType = undefined;
        }
        return {
          sizeBytes: fileStat.size,
          contentType,
        };
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }
        throw error;
      }
    },
    async readObject(key: string, maxBytes?: number): Promise<{ body: Uint8Array; contentType?: string } | null> {
      if (maxBytes !== undefined) {
        assertStorageReadLimit(maxBytes);
      }
      const objectPath = resolveObjectPath(rootDir, key);
      try {
        // Open only after confirming existence; stream bounds still apply if the object grows.
        const fileStat = await stat(objectPath);
        const body = maxBytes === undefined
          ? new Uint8Array(await readFile(objectPath))
          : await readBoundedStorageBody(Readable.toWeb(createReadStream(objectPath)), maxBytes, fileStat.size);
        let contentType: string | undefined;
        try {
          const metadata = JSON.parse(await readFile(metadataPath(objectPath), "utf8")) as StoredObjectMetadata;
          contentType = metadata.contentType;
        }
        catch {
          contentType = undefined;
        }
        return { body, contentType };
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }
        throw error;
      }
    },
    async deleteObject(key: string): Promise<void> {
      const objectPath = resolveObjectPath(rootDir, key);
      const results = await Promise.allSettled([
        unlink(objectPath),
        unlink(metadataPath(objectPath)),
      ]);
      if (results.some(result => result.status === "rejected" && (result.reason as NodeJS.ErrnoException)?.code !== "ENOENT")) {
        throw new Error("LOCAL_FILE_DELETE_FAILED");
      }
    },
    resolvePath(key: string): string {
      return resolveObjectPath(rootDir, key);
    },
  };
}

export interface LocalFileObjectStore {
  rootDir: string;
  putObject: (input: { key: string; body: Uint8Array; contentType: string }) => Promise<{ sizeBytes: number }>;
  headObject: (key: string) => Promise<{ sizeBytes: number; contentType?: string } | null>;
  readObject: (key: string, maxBytes?: number) => Promise<{ body: Uint8Array; contentType?: string } | null>;
  deleteObject: (key: string) => Promise<void>;
  resolvePath: (key: string) => string;
}
