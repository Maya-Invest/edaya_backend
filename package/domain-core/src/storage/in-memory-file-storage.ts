import type {
  CreatePresignedDownloadOptions,
  CreatePresignedUploadInput,
  FileStoragePort,
  HeadObjectResult,
  PutObjectInput,
  PutObjectResult,
} from '../ports/file-storage'

interface StoredObject {
  body: Uint8Array
  contentType: string
  metadata?: Record<string, string>
}

async function readBody(body: PutObjectInput['body']): Promise<Uint8Array> {
  if (body instanceof Uint8Array) {
    return body
  }
  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body)
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let totalLength = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    if (value) {
      chunks.push(value)
      totalLength += value.byteLength
    }
  }

  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

export function createInMemoryFileStorage(): FileStoragePort & {
  readonly objects: Map<string, StoredObject>
} {
  const objects = new Map<string, StoredObject>()

  return {
    objects,
    async putObject(input: PutObjectInput): Promise<PutObjectResult> {
      const body = await readBody(input.body)
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
