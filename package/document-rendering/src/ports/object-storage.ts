export interface PutObjectInput {
  readonly key: string
  readonly body: Uint8Array
  readonly contentType: string
  readonly metadata?: Readonly<Record<string, string>>
}

export interface PutObjectResult {
  readonly etag?: string
  readonly sizeBytes: number
}

export interface PresignedDownload {
  readonly downloadUrl: string
  readonly expiresAt: Date
}

export interface CreateDownloadUrlOptions {
  readonly expiresInSeconds?: number
  readonly fileName?: string
  readonly disposition?: 'inline' | 'attachment'
}

/** Server-side artifact store for `delivery=storage`. Private bucket only. */
export interface ObjectStorage {
  putObject: (input: PutObjectInput) => Promise<PutObjectResult>
  getDownloadUrl: (key: string, options?: CreateDownloadUrlOptions) => Promise<PresignedDownload>
}
