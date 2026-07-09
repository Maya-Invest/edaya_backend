import type { CreatePresignedDownloadOptions, CreatePresignedUploadInput, FileStoragePort, HeadObjectResult, PutObjectInput, PutObjectResult } from "@edaya/core";
import { createInMemoryFileStorage } from "@edaya/core";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

async function readStorageBody(body: PutObjectInput["body"]): Promise<Uint8Array> {
  if (body instanceof Uint8Array) {
    return body;
  }
  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      chunks.push(value);
      totalLength += value.byteLength;
    }
  }

  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, "");
}

export function buildLocalDevMemoryUploadUrl(apiBaseUrl: string, storageKey: string): string {
  return `${normalizeApiBaseUrl(apiBaseUrl)}/core/files/memory/${encodeURIComponent(storageKey)}`;
}

export interface LocalDevStoredObject {
  body: Uint8Array;
  contentType: string;
}

export type LocalDevFileStorage = FileStoragePort & {
  readStoredObject: (storageKey: string) => Promise<LocalDevStoredObject | null>;
};

function storagePaths(persistDir: string, storageKey: string): { objectPath: string; metaPath: string } {
  const objectPath = path.join(persistDir, ...storageKey.split("/"));
  return {
    objectPath,
    metaPath: `${objectPath}.meta.json`,
  };
}

function createLocalDevDiskFileStorage(persistDir: string): LocalDevFileStorage {
  async function readStoredObject(storageKey: string): Promise<LocalDevStoredObject | null> {
    const { objectPath, metaPath } = storagePaths(persistDir, storageKey);
    try {
      const [body, metaRaw] = await Promise.all([
        readFile(objectPath),
        readFile(metaPath, "utf8"),
      ]);
      const meta = JSON.parse(metaRaw) as { contentType?: string };
      return {
        body: new Uint8Array(body),
        contentType: meta.contentType ?? "application/octet-stream",
      };
    }
    catch {
      return null;
    }
  }

  return {
    readStoredObject,
    async putObject(input: PutObjectInput): Promise<PutObjectResult> {
      const body = await readStorageBody(input.body);
      const { objectPath, metaPath } = storagePaths(persistDir, input.key);
      await mkdir(path.dirname(objectPath), { recursive: true });
      await Promise.all([
        writeFile(objectPath, body),
        writeFile(metaPath, JSON.stringify({ contentType: input.contentType })),
      ]);
      return { sizeBytes: body.byteLength };
    },
    async deleteObject(key: string): Promise<void> {
      const { objectPath, metaPath } = storagePaths(persistDir, key);
      await Promise.all([
        unlink(objectPath).catch(() => undefined),
        unlink(metaPath).catch(() => undefined),
      ]);
    },
    async headObject(key: string): Promise<HeadObjectResult | null> {
      const stored = await readStoredObject(key);
      if (!stored) {
        return null;
      }
      return {
        sizeBytes: stored.body.byteLength,
        contentType: stored.contentType,
      };
    },
    async createPresignedUpload(input: CreatePresignedUploadInput) {
      return {
        key: input.key,
        uploadUrl: `disk://upload/${encodeURIComponent(input.key)}`,
        expiresAt: new Date(Date.now() + (input.expiresInSeconds ?? 900) * 1000),
        headers: { "Content-Type": input.contentType },
      };
    },
    async createPresignedDownload(key: string, options?: CreatePresignedDownloadOptions) {
      return {
        downloadUrl: `disk://download/${encodeURIComponent(key)}?name=${encodeURIComponent(options?.fileName ?? "file")}`,
        expiresAt: new Date(Date.now() + (options?.expiresInSeconds ?? 900) * 1000),
      };
    },
  };
}

function wrapWithLocalDevUrls(
  inner: LocalDevFileStorage,
  apiBaseUrl: string,
): LocalDevFileStorage {
  return {
    ...inner,
    async createPresignedUpload(input: CreatePresignedUploadInput) {
      const presigned = await inner.createPresignedUpload(input);
      return {
        ...presigned,
        uploadUrl: buildLocalDevMemoryUploadUrl(apiBaseUrl, input.key),
      };
    },
    async createPresignedDownload(key: string, options?: CreatePresignedDownloadOptions) {
      const fileName = options?.fileName ?? "file";
      const downloadUrl = `${buildLocalDevMemoryUploadUrl(apiBaseUrl, key)}?fileName=${encodeURIComponent(fileName)}`;
      return {
        downloadUrl,
        expiresAt: new Date(Date.now() + (options?.expiresInSeconds ?? 900) * 1000),
      };
    },
  };
}

export interface CreateLocalDevFileStorageOptions {
  /** When set, uploaded blobs are persisted under this directory across API restarts. */
  persistDir?: string;
}

export function createLocalDevFileStorage(
  apiBaseUrl: string,
  options: CreateLocalDevFileStorageOptions = {},
): LocalDevFileStorage {
  const inner = options.persistDir
    ? createLocalDevDiskFileStorage(options.persistDir)
    : createInMemoryLocalDevFileStorage();

  return wrapWithLocalDevUrls(inner, apiBaseUrl);
}

function createInMemoryLocalDevFileStorage(): LocalDevFileStorage {
  const memoryStorage = createInMemoryFileStorage();

  return {
    readStoredObject: async (storageKey: string) => {
      const stored = memoryStorage.objects.get(storageKey);
      if (!stored) {
        return null;
      }
      return stored;
    },
    putObject: input => memoryStorage.putObject(input),
    deleteObject: key => memoryStorage.deleteObject(key),
    headObject: key => memoryStorage.headObject(key),
    createPresignedUpload: input => memoryStorage.createPresignedUpload(input),
    createPresignedDownload: (key, options) => memoryStorage.createPresignedDownload(key, options),
  };
}

export async function readLocalDevStoredObject(
  fileStorage: FileStoragePort,
  storageKey: string,
): Promise<LocalDevStoredObject | null> {
  const localStorage = fileStorage as Partial<LocalDevFileStorage>;
  if (typeof localStorage.readStoredObject === "function") {
    return localStorage.readStoredObject(storageKey);
  }

  const memoryStorage = fileStorage as ReturnType<typeof createInMemoryFileStorage>;
  const stored = memoryStorage.objects?.get(storageKey);
  if (!stored) {
    return null;
  }
  return stored;
}

export async function localDevFileStorageHasObjects(persistDir: string): Promise<boolean> {
  try {
    const entries = await readdir(persistDir, { recursive: true });
    return entries.some(entry => !String(entry).endsWith(".meta.json"));
  }
  catch {
    return false;
  }
}
