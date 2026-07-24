import type { CreateDownloadUrlOptions, ObjectStorage, PresignedDownload, PutObjectInput, PutObjectResult } from '../ports/object-storage.ts'

export interface RecordingObjectStorage extends ObjectStorage {
  readonly puts: PutObjectInput[]
  readonly downloads: string[]
}

export function createRecordingObjectStorage(options?: {
  readonly downloadUrl?: string
  readonly expiresAt?: Date
}): RecordingObjectStorage {
  const puts: PutObjectInput[] = []
  const downloads: string[] = []
  const downloadUrl = options?.downloadUrl ?? 'https://r2.example/download'
  const expiresAt = options?.expiresAt ?? new Date('2030-01-01T00:00:00.000Z')

  return {
    puts,
    downloads,
    async putObject(input: PutObjectInput): Promise<PutObjectResult> {
      puts.push(input)
      return { sizeBytes: input.body.byteLength, etag: '"test-etag"' }
    },
    async getDownloadUrl(key: string, _options?: CreateDownloadUrlOptions): Promise<PresignedDownload> {
      downloads.push(key)
      return { downloadUrl, expiresAt }
    },
  }
}
