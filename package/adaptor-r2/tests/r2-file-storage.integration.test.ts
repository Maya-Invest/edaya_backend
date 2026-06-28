import { afterAll, describe, expect, it } from "bun:test";
import { createR2FileStorage } from "../src/r2-file-storage";
import type { R2Environment } from "../src/types";

function readIntegrationR2Env(): (Required<Pick<R2Environment, "R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_BUCKET_NAME">> & R2Environment) | undefined {
  const env = process.env as NodeJS.ProcessEnv & R2Environment;
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET_NAME) {
    return undefined;
  }
  if (!env.R2_ENDPOINT && !env.R2_ACCOUNT_ID) {
    return undefined;
  }

  return {
    R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
    R2_ENDPOINT: env.R2_ENDPOINT,
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: env.R2_BUCKET_NAME,
  };
}

const integrationEnv = readIntegrationR2Env();

if (integrationEnv) {
  describe("R2 file storage integration", () => {
    const storage = createR2FileStorage({
      accountId: integrationEnv.R2_ACCOUNT_ID,
      accessKeyId: integrationEnv.R2_ACCESS_KEY_ID,
      secretAccessKey: integrationEnv.R2_SECRET_ACCESS_KEY,
      bucketName: integrationEnv.R2_BUCKET_NAME,
      endpoint: integrationEnv.R2_ENDPOINT,
    });

    const testKey = `integration-test/${crypto.randomUUID()}/sample.txt`;
    const testBody = new TextEncoder().encode("edaya-r2-integration-test");
    const testContentType = "text/plain";

    afterAll(async () => {
      await storage.deleteObject(testKey);
    });

    it("puts, heads, presigns download, and deletes an object", async () => {
      const putResult = await storage.putObject({
        key: testKey,
        body: testBody,
        contentType: testContentType,
      });
      expect(putResult.sizeBytes).toBe(testBody.byteLength);

      const head = await storage.headObject(testKey);
      expect(head?.sizeBytes).toBe(testBody.byteLength);
      expect(head?.contentType).toBe(testContentType);

      const presignedUpload = await storage.createPresignedUpload({
        key: `${testKey}-presign`,
        contentType: testContentType,
        sizeBytes: testBody.byteLength,
        expiresInSeconds: 60,
      });
      expect(presignedUpload.uploadUrl).toContain("r2.cloudflarestorage.com");
      expect(presignedUpload.uploadUrl).toContain(`/${integrationEnv.R2_BUCKET_NAME}/`);
      expect(presignedUpload.uploadUrl).not.toContain("x-amz-sdk-checksum-algorithm");

      const presignedPut = await fetch(presignedUpload.uploadUrl, {
        method: "PUT",
        headers: presignedUpload.headers ?? { "Content-Type": testContentType },
        body: testBody,
      });
      expect(presignedPut.ok).toBe(true);

      const presignedHead = await storage.headObject(`${testKey}-presign`);
      expect(presignedHead?.sizeBytes).toBe(testBody.byteLength);

      const presignedDownload = await storage.createPresignedDownload(testKey, {
        fileName: "sample.txt",
        expiresInSeconds: 60,
      });
      expect(presignedDownload.downloadUrl).toContain("r2.cloudflarestorage.com");

      const response = await fetch(presignedDownload.downloadUrl);
      expect(response.ok).toBe(true);
      const downloaded = new TextDecoder().decode(await response.arrayBuffer());
      expect(downloaded).toBe("edaya-r2-integration-test");

      await storage.deleteObject(`${testKey}-presign`);
    });
  });
}
