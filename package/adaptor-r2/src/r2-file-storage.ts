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
import { assertStorageReadLimit, FileStorageReadError, readBoundedStorageBody } from "@edaya/core";

export interface R2FileStorageConfig {
  /** Cloudflare account id — used only to derive the endpoint when `endpoint` is unset. */
  accountId?: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  /** Jurisdiction-specific S3 API endpoint from the R2 dashboard. Takes precedence over `accountId`. */
  endpoint?: string;
  /** Optional public base URL for custom domains — presigned URLs use the R2 endpoint by default. */
  publicBaseUrl?: string;
}

const DEFAULT_UPLOAD_TTL_SECONDS = 900;
const DEFAULT_DOWNLOAD_TTL_SECONDS = 900;

export function resolveR2Endpoint(config: { accountId?: string; endpoint?: string }): string {
  if (config.endpoint) {
    return config.endpoint.replace(/\/$/, "");
  }

  if (config.accountId) {
    return `https://${config.accountId}.r2.cloudflarestorage.com`;
  }

  throw new Error("R2 file storage requires R2_ENDPOINT or R2_ACCOUNT_ID");
}

async function readBody(body: PutObjectInput["body"]): Promise<Uint8Array | ReadableStream> {
  if (body instanceof Uint8Array || body instanceof ReadableStream) {
    return body;
  }
  return new Uint8Array(body);
}

export function createR2FileStorage(config: R2FileStorageConfig): FileStoragePort {
  const endpoint = resolveR2Endpoint(config);
  const client = new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Presigned browser/seed PUTs only send Content-Type; disable default CRC32 query params.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return {
    async readObject(key, { maxBytes }) {
      assertStorageReadLimit(maxBytes);
      try {
        const response = await client.send(new GetObjectCommand({
          Bucket: config.bucketName,
          Key: key,
        }));
        if (!response.Body) {
          throw new FileStorageReadError("FILE_READ_FAILED");
        }
        const body = await readBoundedStorageBody(response.Body.transformToWebStream(), maxBytes, response.ContentLength);
        return { body, sizeBytes: body.byteLength, contentType: response.ContentType, etag: response.ETag };
      }
      catch (error) {
        const status = error && typeof error === "object"
          ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
          : undefined;
        if (status === 404) {
          return null;
        }
        if (error instanceof FileStorageReadError) {
          throw error;
        }
        throw new FileStorageReadError("FILE_READ_FAILED");
      }
    },
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
      assertStorageReadLimit(input.sizeBytes);
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
      const disposition = options?.disposition ?? "attachment";
      const getCommand = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        ResponseContentDisposition: options?.fileName
          ? `${disposition}; filename="${options.fileName.replace(/"/g, "")}"`
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
