import type {
  CreateDownloadUrlOptions,
  ObjectStorage,
  PutObjectInput,
  PutObjectResult,
} from '../ports/object-storage.ts'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export interface R2ObjectStorageConfig {
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly bucketName: string
  readonly accountId?: string
  readonly endpoint?: string
}

const DEFAULT_DOWNLOAD_TTL_SECONDS = 900

export function resolveR2Endpoint(config: { accountId?: string, endpoint?: string }): string {
  if (config.endpoint)
    return config.endpoint.replace(/\/$/, '')
  if (config.accountId)
    return `https://${config.accountId}.r2.cloudflarestorage.com`
  throw new Error('R2 object storage requires R2_ENDPOINT or R2_ACCOUNT_ID')
}

export function createR2ObjectStorage(config: R2ObjectStorageConfig): ObjectStorage {
  const endpoint = resolveR2Endpoint(config)
  const client = new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })

  return {
    async putObject(input: PutObjectInput): Promise<PutObjectResult> {
      const response = await client.send(new PutObjectCommand({
        Bucket: config.bucketName,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: input.metadata,
      }))
      return {
        ...(response.ETag === undefined ? {} : { etag: response.ETag }),
        sizeBytes: input.body.byteLength,
      }
    },

    async getDownloadUrl(key: string, options?: CreateDownloadUrlOptions) {
      const expiresIn = options?.expiresInSeconds ?? DEFAULT_DOWNLOAD_TTL_SECONDS
      const disposition = options?.disposition ?? 'attachment'
      const command = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        ...(options?.fileName === undefined
          ? {}
          : {
              ResponseContentDisposition: `${disposition}; filename="${options.fileName.replaceAll('"', '')}"`,
            }),
      })
      const downloadUrl = await getSignedUrl(client, command, { expiresIn })
      return {
        downloadUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      }
    },
  }
}
