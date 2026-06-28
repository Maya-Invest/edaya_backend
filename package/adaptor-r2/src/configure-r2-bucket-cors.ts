import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import type { R2FileStorageConfig } from "./r2-file-storage";
import { resolveR2Endpoint } from "./r2-file-storage";

const DEFAULT_BROWSER_ORIGINS = ["http://localhost:5173", "http://localhost:4173"];

export interface R2BucketCorsRule {
  AllowedOrigins: string[];
  AllowedMethods: string[];
  AllowedHeaders: string[];
  ExposeHeaders: string[];
  MaxAgeSeconds: number;
}

export function buildBrowserUploadCorsOrigins(extraOrigins: readonly string[] = []): string[] {
  return [...new Set([
    ...DEFAULT_BROWSER_ORIGINS,
    ...extraOrigins.map(origin => origin.trim()).filter(Boolean),
  ])];
}

export function buildR2BucketCorsRules(allowedOrigins: readonly string[]): R2BucketCorsRule[] {
  return [
    {
      AllowedOrigins: [...allowedOrigins],
      AllowedMethods: ["GET", "PUT", "HEAD"],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3600,
    },
  ];
}

export function buildWranglerR2CorsPolicy(allowedOrigins: readonly string[]) {
  return {
    rules: [
      {
        allowed: {
          origins: [...allowedOrigins],
          methods: ["GET", "PUT", "HEAD"],
          headers: ["*"],
        },
        exposeHeaders: ["ETag"],
        maxAgeSeconds: 3600,
      },
    ],
  };
}

function createR2S3Client(config: R2FileStorageConfig): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: resolveR2Endpoint(config),
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function configureR2BucketCors(
  config: R2FileStorageConfig,
  allowedOrigins: readonly string[],
): Promise<void> {
  const client = createR2S3Client(config);
  await client.send(new PutBucketCorsCommand({
    Bucket: config.bucketName,
    CORSConfiguration: {
      CORSRules: buildR2BucketCorsRules(allowedOrigins),
    },
  }));
}
