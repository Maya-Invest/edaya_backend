import { describe, expect, it } from "bun:test";
import { parseEnv } from "@/runtime";
import {
  Attachment,
  AttachmentOwnerKind,
  AttachmentStatus,
} from "@edaya/core";
import type { AppBindings } from "@/http/types";
import indexRouter from "@/app-router";
import { Hono } from "hono";

const baseEnv = parseEnv({
  RUNTIME: "in-memory",
  NODE_ENV: "test",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgres://admin:admin@localhost:5432/test_db",
  BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
  BETTER_AUTH_URL: "http://localhost:9999",
});

describe("file content route", () => {
  it("redirects public profile images to a presigned download URL", async () => {
    const presignedUrl = "https://account.r2.cloudflarestorage.com/bucket/school-1/uploads/staff/staff-1/att-1/profile.jpg?sig=test";
    const attachment = new Attachment({
      id: "att-1",
      schoolId: "school-1",
      ownerKind: AttachmentOwnerKind.Staff,
      ownerId: "staff-1",
      fileName: "profile.jpg",
      storageKey: "school-1/uploads/staff/staff-1/att-1/profile.jpg",
      status: AttachmentStatus.Ready,
      mimeType: "image/jpeg",
      sizeBytes: 3,
    });

    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = baseEnv;
      c.set("actor", null);
      c.set("schoolApp", {
        repositories: {
          attachments: {
            findById: async (id: string) => (id === attachment.id ? attachment : undefined),
          },
        },
        fileStorage: {
          createPresignedDownload: async (_key: string, options?: { fileName?: string; disposition?: string }) => {
            expect(options).toEqual({
              fileName: "profile.jpg",
              disposition: "inline",
            });
            return {
              downloadUrl: presignedUrl,
              expiresAt: new Date(),
            };
          },
        },
      } as any);
      await next();
    });
    app.route("/", indexRouter);

    const res = await app.request("/core/files/att-1/content", { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(presignedUrl);
  });
});
