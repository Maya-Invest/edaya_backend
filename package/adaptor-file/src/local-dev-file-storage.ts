import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  CreatePresignedDownloadOptions,
  CreatePresignedUploadInput,
  FileStoragePort,
  HeadObjectResult,
  PutObjectInput,
  PutObjectResult,
} from "@edaya/core";
import { createDevStorageToken } from "./dev-storage-token";
import { readStorageBody } from "./read-storage-body";

export const DEV_FILE_UPLOAD_PATH = "/core/dev/files/upload";
export const DEV_FILE_DOWNLOAD_PATH = "/core/dev/files/download";

export interface LocalDevFileStorageConfig {
  rootDir: string;
  publicBaseUrl: string;
  signingSecret: string;
}

interface ObjectMetadata {
  contentType: string;
}

function resolveObjectPath(rootDir: string, key: string): string {
  const segments = key.split("/").filter(Boolean);
  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      throw new Error(`Invalid storage key: ${key}`);
    }
  }

  const objectPath = path.join(rootDir, ...segments);
  const rootResolved = path.resolve(rootDir);
  const resolved = path.resolve(objectPath);
  if (resolved !== rootResolved && !resolved.startsWith(`${rootResolved}${path.sep}`)) {
    throw new Error(`Invalid storage key path: ${key}`);
  }
  return resolved;
}

function metadataPath(objectPath: string): string {
  return `${objectPath}.meta.json`;
}

async function readMetadata(objectPath: string): Promise<ObjectMetadata | null> {
  try {
    const raw = await readFile(metadataPath(objectPath), "utf8");
    return JSON.parse(raw) as ObjectMetadata;
  }
  catch {
    return null;
  }
}

async function writeMetadata(objectPath: string, metadata: ObjectMetadata): Promise<void> {
  await mkdir(path.dirname(objectPath), { recursive: true });
  await writeFile(metadataPath(objectPath), JSON.stringify(metadata), "utf8");
}

function buildSignedUrl(
  config: LocalDevFileStorageConfig,
  operation: "upload" | "download",
  key: string,
  expiresAt: Date,
  contentType?: string,
  fileName?: string,
  disposition?: "inline" | "attachment",
): string {
  const expiresAtMs = expiresAt.getTime();
  const token = createDevStorageToken(config.signingSecret, {
    operation,
    key,
    expiresAt: expiresAtMs,
    contentType,
  });
  const url = new URL(
    operation === "upload" ? DEV_FILE_UPLOAD_PATH : DEV_FILE_DOWNLOAD_PATH,
    config.publicBaseUrl,
  );
  url.searchParams.set("key", key);
  url.searchParams.set("expires", String(expiresAtMs));
  url.searchParams.set("sig", token);
  if (contentType) {
    url.searchParams.set("contentType", contentType);
  }
  if (fileName) {
    url.searchParams.set("fileName", fileName);
  }
  if (disposition) {
    url.searchParams.set("disposition", disposition);
  }
  return url.toString();
}

export function createLocalDevFileStorage(config: LocalDevFileStorageConfig): FileStoragePort {
  return {
    async putObject(input: PutObjectInput): Promise<PutObjectResult> {
      const body = await readStorageBody(input.body);
      await writeLocalDevObject(config.rootDir, input.key, body, input.contentType);
      return { sizeBytes: body.byteLength };
    },
    async deleteObject(key: string): Promise<void> {
      await deleteLocalDevObject(config.rootDir, key);
    },
    async headObject(key: string): Promise<HeadObjectResult | null> {
      return headLocalDevObject(config.rootDir, key);
    },
    async createPresignedUpload(input: CreatePresignedUploadInput) {
      const expiresIn = input.expiresInSeconds ?? 900;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      return {
        key: input.key,
        uploadUrl: buildSignedUrl(config, "upload", input.key, expiresAt, input.contentType),
        expiresAt,
        headers: { "Content-Type": input.contentType },
      };
    },
    async createPresignedDownload(key: string, options?: CreatePresignedDownloadOptions) {
      const expiresIn = options?.expiresInSeconds ?? 900;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      return {
        downloadUrl: buildSignedUrl(
          config,
          "download",
          key,
          expiresAt,
          undefined,
          options?.fileName,
          options?.disposition,
        ),
        expiresAt,
      };
    },
  };
}

export async function writeLocalDevObject(
  rootDir: string,
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  const objectPath = resolveObjectPath(rootDir, key);
  await mkdir(path.dirname(objectPath), { recursive: true });
  await writeFile(objectPath, body);
  await writeMetadata(objectPath, { contentType });
}

export async function readLocalDevObject(
  rootDir: string,
  key: string,
): Promise<{ body: Uint8Array; contentType?: string } | null> {
  const objectPath = resolveObjectPath(rootDir, key);
  try {
    const [body, metadata] = await Promise.all([
      readFile(objectPath),
      readMetadata(objectPath),
    ]);
    return {
      body: new Uint8Array(body),
      contentType: metadata?.contentType,
    };
  }
  catch {
    return null;
  }
}

export async function headLocalDevObject(
  rootDir: string,
  key: string,
): Promise<HeadObjectResult | null> {
  const objectPath = resolveObjectPath(rootDir, key);
  try {
    const fileStat = await stat(objectPath);
    const metadata = await readMetadata(objectPath);
    return {
      sizeBytes: fileStat.size,
      contentType: metadata?.contentType,
    };
  }
  catch {
    return null;
  }
}

export async function deleteLocalDevObject(rootDir: string, key: string): Promise<void> {
  const objectPath = resolveObjectPath(rootDir, key);
  await rm(objectPath, { force: true });
  await rm(metadataPath(objectPath), { force: true });
}
