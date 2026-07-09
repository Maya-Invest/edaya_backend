import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import {
  buildBrowserUploadCorsOrigins,
  buildR2BucketCorsRules,
  buildWranglerR2CorsPolicy,
  configureR2BucketCors,
} from "../src/configure-r2-bucket-cors";

describe("buildBrowserUploadCorsOrigins", () => {
  it("includes local dev defaults and merges TRUSTED_ORIGINS without duplicates", () => {
    expect(buildBrowserUploadCorsOrigins([
      "https://app.edaya.com",
      "http://localhost:5173",
    ])).toEqual([
      "http://localhost:5173",
      "http://localhost:4173",
      "https://app.edaya.com",
    ]);
  });
});

describe("buildR2BucketCorsRules", () => {
  it("builds S3-compatible CORS rules for browser uploads", () => {
    expect(buildR2BucketCorsRules(["https://app.edaya.com"])).toEqual([
      {
        AllowedOrigins: ["https://app.edaya.com"],
        AllowedMethods: ["GET", "PUT", "HEAD"],
        AllowedHeaders: ["*"],
        ExposeHeaders: ["ETag"],
        MaxAgeSeconds: 3600,
      },
    ]);
  });
});

describe("buildWranglerR2CorsPolicy", () => {
  it("builds wrangler-compatible CORS policy rules", () => {
    expect(buildWranglerR2CorsPolicy(["https://app.edaya.com"])).toEqual({
      rules: [
        {
          allowed: {
            origins: ["https://app.edaya.com"],
            methods: ["GET", "PUT", "HEAD"],
            headers: ["*"],
          },
          exposeHeaders: ["ETag"],
          maxAgeSeconds: 3600,
        },
      ],
    });
  });
});

describe("configureR2BucketCors", () => {
  const config = {
    accountId: "test-account-id",
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
    bucketName: "edaya-files-dev",
  };

  afterEach(() => {
    spyOn(S3Client.prototype, "send").mockRestore();
  });

  it("applies browser upload CORS rules to the configured bucket", async () => {
    const send = spyOn(S3Client.prototype, "send").mockImplementation(async () => ({}));

    await configureR2BucketCors(config, ["https://app.edaya.com"]);

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutBucketCorsCommand);
    expect((command as PutBucketCorsCommand).input.Bucket).toBe("edaya-files-dev");
  });
});
