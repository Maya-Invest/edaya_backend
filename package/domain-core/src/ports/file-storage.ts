export interface PutObjectInput {
  key: string
  body: ReadableStream | Uint8Array | ArrayBuffer
  contentType: string
  metadata?: Record<string, string>
}

export interface PutObjectResult {
  etag?: string
  sizeBytes: number
}

export interface HeadObjectResult {
  sizeBytes: number
  contentType?: string
  etag?: string
}

export interface PresignedUpload {
  key: string
  uploadUrl: string
  expiresAt: Date
  headers?: Record<string, string>
}

export interface PresignedDownload {
  downloadUrl: string
  expiresAt: Date
}

export interface CreatePresignedUploadInput {
  key: string
  contentType: string
  sizeBytes: number
  expiresInSeconds?: number
}

export interface CreatePresignedDownloadOptions {
  expiresInSeconds?: number
  fileName?: string
  disposition?: 'inline' | 'attachment'
}

/**
 * Object storage port for user uploads and server-generated documents.
 * Implementations must use private buckets; callers issue short-lived presigned URLs.
 */
export interface FileStoragePort {
  putObject: (input: PutObjectInput) => Promise<PutObjectResult>
  deleteObject: (key: string) => Promise<void>
  headObject: (key: string) => Promise<HeadObjectResult | null>
  createPresignedUpload: (input: CreatePresignedUploadInput) => Promise<PresignedUpload>
  createPresignedDownload: (key: string, options?: CreatePresignedDownloadOptions) => Promise<PresignedDownload>
}
