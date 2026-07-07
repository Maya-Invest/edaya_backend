import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createR2FileStorage, resolveR2Endpoint } from "../src/r2-file-storage";

describe("resolveR2Endpoint", () => {
  it("throws when neither endpoint nor account id is configured", () => {
    expect(() => resolveR2Endpoint({})).toThrow("R2 file storage requires R2_ENDPOINT or R2_ACCOUNT_ID");
  });
});

describe("createR2FileStorage object operations", () => {
  const config = {
    accountId: "test-account-id",
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
    bucketName: "edaya-files-dev",
  };

  afterEach(() => {
    mock.restore();
  });

  it("uploads, heads, downloads, and deletes objects through the S3 client", async () => {
    const send = spyOn(S3Client.prototype, "send").mockImplementation(async (command) => {
      if (command instanceof PutObjectCommand) {
        return { ETag: "\"etag-1\"" };
      }
      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: 128,
          ContentType: "image/jpeg",
          ETag: "\"etag-1\"",
        };
      }
      if (command instanceof DeleteObjectCommand) {
        return {};
      }
      if (command instanceof GetObjectCommand) {
        return {};
      }
      throw new Error(`Unexpected command ${command.constructor.name}`);
    });

    const storage = createR2FileStorage(config);

    const putResult = await storage.putObject({
      key: "school/uploads/staff/st1/profile.jpg",
      contentType: "image/jpeg",
      body: new Uint8Array([1, 2, 3]),
    });
    expect(putResult).toEqual({ etag: "\"etag-1\"", sizeBytes: 3 });

    await expect(storage.headObject("school/uploads/staff/st1/profile.jpg")).resolves.toEqual({
      sizeBytes: 128,
      contentType: "image/jpeg",
      etag: "\"etag-1\"",
    });

    const download = await storage.createPresignedDownload("school/uploads/staff/st1/profile.jpg", {
      fileName: "profile.jpg",
      disposition: "inline",
    });
    expect(download.downloadUrl).toContain("r2.cloudflarestorage.com");

    await storage.deleteObject("school/uploads/staff/st1/profile.jpg");
    expect(send.mock.calls.some(([command]) => command instanceof DeleteObjectCommand)).toBe(true);
  });

  it("returns null from headObject when the object does not exist", async () => {
    spyOn(S3Client.prototype, "send").mockImplementation(async (command) => {
      if (command instanceof HeadObjectCommand) {
        const error = new Error("Not found") as Error & { $metadata?: { httpStatusCode?: number } };
        error.$metadata = { httpStatusCode: 404 };
        throw error;
      }
      return {};
    });

    const storage = createR2FileStorage(config);
    await expect(storage.headObject("missing-object")).resolves.toBeNull();
  });

  it("accepts readable stream bodies for uploads", async () => {
    spyOn(S3Client.prototype, "send").mockImplementation(async () => ({ ETag: "\"etag-stream\"" }));

    const storage = createR2FileStorage(config);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([9]));
        controller.close();
      },
    });

    const putResult = await storage.putObject({
      key: "school/uploads/stream.bin",
      contentType: "application/octet-stream",
      body: stream,
    });

    expect(putResult.etag).toBe("\"etag-stream\"");
    expect(putResult.sizeBytes).toBe(0);
  });
});
