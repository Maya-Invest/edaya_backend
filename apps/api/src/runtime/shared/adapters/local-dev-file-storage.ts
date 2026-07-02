import type {
  CreatePresignedDownloadOptions,
  CreatePresignedUploadInput,
  FileStoragePort,
} from "@edaya/core";
import { createInMemoryFileStorage } from "@edaya/core";

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, "");
}

export function buildLocalDevMemoryUploadUrl(apiBaseUrl: string, storageKey: string): string {
  return `${normalizeApiBaseUrl(apiBaseUrl)}/core/files/memory/${encodeURIComponent(storageKey)}`;
}

export function createLocalDevFileStorage(apiBaseUrl: string): ReturnType<typeof createInMemoryFileStorage> {
  const inner = createInMemoryFileStorage();

  return {
    ...inner,
    async createPresignedUpload(input: CreatePresignedUploadInput) {
      return {
        key: input.key,
        uploadUrl: buildLocalDevMemoryUploadUrl(apiBaseUrl, input.key),
        expiresAt: new Date(Date.now() + (input.expiresInSeconds ?? 900) * 1000),
        headers: { "Content-Type": input.contentType },
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

export function readLocalDevMemoryObject(
  fileStorage: FileStoragePort,
  storageKey: string,
): { body: Uint8Array; contentType: string } | null {
  const memoryStorage = fileStorage as ReturnType<typeof createInMemoryFileStorage>;
  const stored = memoryStorage.objects.get(storageKey);
  if (!stored) {
    return null;
  }
  return stored;
}
