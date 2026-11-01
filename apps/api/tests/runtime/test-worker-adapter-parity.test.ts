import { expect, test } from "bun:test";
import type { NotifyRuntime } from "@edaya/adaptor-notify";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { DatabaseHandle } from "@/runtime/types";
import { createApiRuntime } from "@/runtime/shared/create-api-runtime";
import { resolveFileStorage } from "@/runtime/shared/adapters/file-storage";
import { createPgliteTestEnv } from "../support/pglite-env";

for (const API_ORIGIN of ["https://staging.api.edayaplus.com", "https://api.edayaplus.com"]) {
  test(`${API_ORIGIN}: shared notification composition retains ordinary recipients and selects Worker adapters`, async () => {
    let notify: NotifyRuntime | undefined;
    const sent: unknown[] = [];
    const env = createPgliteTestEnv({
      RUNTIME: "worker",
      NODE_ENV: "production",
      API_ORIGIN,
      EMAIL_TRANSPORT: "cloudflare",
      EMAIL: { async send(message: unknown) {
        sent.push(message);
        return { messageId: "cloudflare-message" };
      } },
      DATABASE_URL: "postgres://example/db",
      R2_BUCKET_NAME: "fixture-bucket",
      R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
      R2_ACCESS_KEY_ID: "fixture-key",
      R2_SECRET_ACCESS_KEY: "fixture-secret",
    });
    // Only the repository-facing recipient policy is stubbed. Runtime composition,
    // notification resolution and adapter selection are the real implementations.
    const school = {
      forActor: () => ({ baseService: {
        atomicExecution: { execute: async (work: () => Promise<unknown>) => work() },
        access: { notifications: { recipient: async () => ({ kind: "staff", profile: {
          id: "staff",
          schoolId: "school",
          subjectId: "account",
          accountKind: "human",
          isActive: true,
          fullName: "Test recipient",
          email: "ordinary@example.test",
        } }) } },
      } }),
    } as unknown as ApiSchoolApplication;
    const runtime = await createApiRuntime({
      env,
      resolveSchoolHandle: async () => ({ db: {}, dispose: async () => {} }) as DatabaseHandle,
      initSchoolApplication: async (_db, extras) => {
        notify = extras.notifyRuntime;
        return school;
      },
    });
    try {
      await runtime.getSchoolApplication();
      const profile = await notify!.resolveSchoolRecipient!({
        deliveryId: "delivery",
        schoolId: "school",
        subjectId: "account",
        recipientKind: "staff",
        recipientId: "staff",
        eventKey: "fixture.event",
        metadata: {},
      } as Parameters<NonNullable<NotifyRuntime["resolveSchoolRecipient"]>>[0]);
      expect(profile?.email).toBe("ordinary@example.test");
      const message = { to: profile!.email!, from: { email: "noreply@example.test" }, subject: "Fixture", html: "Fixture", idempotencyKey: "fixture" };
      expect(await notify!.email.send(message)).toEqual({ providerMessageId: "cloudflare-message" });
      expect(sent).toHaveLength(1);
      expect(notify!.sms.implemented).toBe(false);
      const upload = await resolveFileStorage(env).createPresignedUpload({ key: "fixture.jpg", contentType: "image/jpeg", sizeBytes: 1 });
      expect(upload.uploadUrl).toContain("example.r2.cloudflarestorage.com");
    }
    finally {
      await runtime.close();
    }
  });
}
