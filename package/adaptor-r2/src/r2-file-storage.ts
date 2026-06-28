import type {
  CreatePresignedDownloadOptions,
  CreatePresignedUploadInput,
  FileStoragePort,
  HeadObjectResult,
  PutObjectInput,
  PutObjectResult,
} from "@edaya/core";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface R2FileStorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  /** Optional public base URL for custom domains — presigned URLs use the R2 endpoint by default. */
  publicBaseUrl?: string;
}

const DEFAULT_UPLOAD_TTL_SECONDS = 900;
const DEFAULT_DOWNLOAD_TTL_SECONDS = 900;

async function readBody(body: PutObjectInput["body"]): Promise<Uint8Array | ReadableStream> {
  if (body instanceof Uint8Array || body instanceof ReadableStream) {
    return body;
  }
  return new Uint8Array(body);
}

export function createR2FileStorage(config: R2FileStorageConfig): FileStoragePort {
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    async putObject(input: PutObjectInput): Promise<PutObjectResult> {
      const body = await readBody(input.body);
      const response = await client.send(new PutObjectCommand({
        Bucket: config.bucketName,
        Key: input.key,
        Body: body,
        ContentType: input.contentType,
        Metadata: input.metadata,
      }));
      const sizeBytes = body instanceof Uint8Array
        ? body.byteLength
        : 0;
      return {
        etag: response.ETag,
        sizeBytes,
      };
    },
    async deleteObject(key: string): Promise<void> {
      await client.send(new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      }));
    },
    async headObject(key: string): Promise<HeadObjectResult | null> {
      try {
        const response = await client.send(new HeadObjectCommand({
          Bucket: config.bucketName,
          Key: key,
        }));
        return {
          sizeBytes: response.ContentLength ?? 0,
          contentType: response.ContentType,
          etag: response.ETag,
        };
      }
      catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 404) {
          return null;
        }
        throw error;
      }
    },
    async createPresignedUpload(input: CreatePresignedUploadInput) {
      const expiresIn = input.expiresInSeconds ?? DEFAULT_UPLOAD_TTL_SECONDS;
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: input.key,
        ContentType: input.contentType,
        ContentLength: input.sizeBytes,
      });
      const uploadUrl = await getSignedUrl(client, command, { expiresIn });
      return {
        key: input.key,
        uploadUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        headers: { "Content-Type": input.contentType },
      };
    },
    async createPresignedDownload(key: string, options?: CreatePresignedDownloadOptions) {
      const expiresIn = options?.expiresInSeconds ?? DEFAULT_DOWNLOAD_TTL_SECONDS;
      const getCommand = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        ResponseContentDisposition: options?.fileName
          ? `attachment; filename="${options.fileName.replace(/"/g, "")}"`
          : undefined,
      });
      const downloadUrl = await getSignedUrl(client, getCommand, { expiresIn });
      return {
        downloadUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };
    },
  };
}
