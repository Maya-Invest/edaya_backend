import type {
  CreatePresignedDownloadOptions,
  CreatePresignedUploadInput,
  FileStoragePort,
  HeadObjectResult,
  PutObjectInput,
  PutObjectResult,
} from '../ports/file-storage'
import { readStorageBody } from './read-storage-body'

interface StoredObject {
  body: Uint8Array
  contentType: string
  metadata?: Record<string, string>
}

export function createInMemoryFileStorage(): FileStoragePort & {
  readonly objects: Map<string, StoredObject>
} {
  const objects = new Map<string, StoredObject>()

  return {
    objects,
    async putObject(input: PutObjectInput): Promise<PutObjectResult> {
      const body = await readStorageBody(input.body)
      objects.set(input.key, {
        body,
        contentType: input.contentType,
        metadata: input.metadata,
      })
      return { sizeBytes: body.byteLength }
    },
    async deleteObject(key: string): Promise<void> {
      objects.delete(key)
    },
    async headObject(key: string): Promise<HeadObjectResult | null> {
      const stored = objects.get(key)
      if (!stored) {
        return null
      }
      return {
        sizeBytes: stored.body.byteLength,
        contentType: stored.contentType,
      }
    },
    async createPresignedUpload(input: CreatePresignedUploadInput) {
      return {
        key: input.key,
        uploadUrl: `memory://upload/${encodeURIComponent(input.key)}`,
        expiresAt: new Date(Date.now() + (input.expiresInSeconds ?? 900) * 1000),
        headers: { 'Content-Type': input.contentType },
      }
    },
    async createPresignedDownload(key: string, options?: CreatePresignedDownloadOptions) {
      return {
        downloadUrl: `memory://download/${encodeURIComponent(key)}?name=${encodeURIComponent(options?.fileName ?? 'file')}`,
        expiresAt: new Date(Date.now() + (options?.expiresInSeconds ?? 900) * 1000),
      }
    },
  }
}
