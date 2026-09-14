import type {
  CreatePresignedDownloadOptions,
  CreatePresignedUploadInput,
  FileStoragePort,
  HeadObjectResult,
  PutObjectInput,
  PutObjectResult,
} from "@edaya/core";
import {
  buildDownloadTokenPayload,
  buildUploadTokenPayload,
  createLocalFileToken,
} from "./tokens";
import type { LocalFileStorageConfig } from "./types";
import { DEFAULT_DOWNLOAD_TTL_SECONDS, DEFAULT_UPLOAD_TTL_SECONDS } from "./types";
import { assertStorageReadLimit, FileStorageReadError, readBoundedStorageBody } from "@edaya/core";

async function readBody(body: PutObjectInput["body"]): Promise<Uint8Array> {
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

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function internalHeaders(secret: string): Record<string, string> {
  return {
    Authorization: `Bearer ${secret}`,
  };
}

async function readErrorBody(response: Response): Promise<string> {
  const text = (await response.text()).trim();
  return text.slice(0, 300);
}

export function createLocalFileStorage(config: LocalFileStorageConfig): FileStoragePort {
  const baseUrl = trimTrailingSlash(config.baseUrl);

  return {
    async readObject(key, { maxBytes }) {
      assertStorageReadLimit(maxBytes);
      try {
        const response = await fetch(`${baseUrl}/internal/objects/content?key=${encodeURIComponent(key)}&maxBytes=${maxBytes}`, {
          headers: internalHeaders(config.secret),
          redirect: "error",
        });
        if (response.status === 404) {
          await response.body?.cancel();
          return null;
        }
        if (!response.ok || !response.body) {
          await response.body?.cancel();
          throw new FileStorageReadError(response.status === 413 ? "FILE_READ_LIMIT_EXCEEDED" : "FILE_READ_FAILED");
        }
        const length = response.headers.get("content-length");
        const body = await readBoundedStorageBody(response.body, maxBytes, length === null ? undefined : Number(length));
        return { body, sizeBytes: body.byteLength, contentType: response.headers.get("content-type") ?? undefined };
      }
      catch (error) {
        if (error instanceof FileStorageReadError) {
          throw error;
        }
        throw new FileStorageReadError("FILE_READ_FAILED");
      }
    },
    async putObject(input: PutObjectInput): Promise<PutObjectResult> {
      const body = await readBody(input.body);
      const response = await fetch(`${baseUrl}/internal/objects`, {
        method: "PUT",
        headers: {
          ...internalHeaders(config.secret),
          "Content-Type": input.contentType,
          "X-Storage-Key": input.key,
        },
        body,
      });
      if (!response.ok) {
        throw new Error(`Local file storage putObject failed (${response.status}): ${await readErrorBody(response)}`);
      }
      const result = await response.json() as { sizeBytes: number };
      return { sizeBytes: result.sizeBytes };
    },
    async deleteObject(key: string): Promise<void> {
      const response = await fetch(`${baseUrl}/internal/objects?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: internalHeaders(config.secret),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Local file storage deleteObject failed (${response.status}): ${await readErrorBody(response)}`);
      }
    },
    async headObject(key: string): Promise<HeadObjectResult | null> {
      const response = await fetch(`${baseUrl}/internal/objects/metadata?key=${encodeURIComponent(key)}`, {
        method: "GET",
        headers: internalHeaders(config.secret),
      });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Local file storage headObject failed (${response.status}): ${await readErrorBody(response)}`);
      }
      return await response.json() as HeadObjectResult;
    },
    async createPresignedUpload(input: CreatePresignedUploadInput) {
      const expiresInSeconds = input.expiresInSeconds ?? DEFAULT_UPLOAD_TTL_SECONDS;
      const payload = buildUploadTokenPayload({
        key: input.key,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        expiresInSeconds,
      });
      const token = createLocalFileToken(config.secret, payload);
      return {
        key: input.key,
        uploadUrl: `${baseUrl}/upload?token=${encodeURIComponent(token)}`,
        expiresAt: new Date(payload.exp * 1000),
        headers: { "Content-Type": input.contentType },
      };
    },
    async createPresignedDownload(key: string, options?: CreatePresignedDownloadOptions) {
      const expiresInSeconds = options?.expiresInSeconds ?? DEFAULT_DOWNLOAD_TTL_SECONDS;
      const payload = buildDownloadTokenPayload(key, {
        expiresInSeconds,
        fileName: options?.fileName,
        disposition: options?.disposition,
      });
      const token = createLocalFileToken(config.secret, payload);
      return {
        downloadUrl: `${baseUrl}/download?token=${encodeURIComponent(token)}`,
        expiresAt: new Date(payload.exp * 1000),
      };
    },
  };
}
