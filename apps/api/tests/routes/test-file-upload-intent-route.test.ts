import { describe, expect, it } from "bun:test";
import { parseEnv } from "@/runtime";
import { AttachmentOwnerKind, Permission } from "@edaya/core";
import { ActorAssuranceLevel, createStaffActorMetadata } from "@edaya/authorization";
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

const staffWithAttachmentConfigure = createStaffActorMetadata({
  schoolId: "school-1",
  subjectId: "auth-staff",
  requestId: "req-1",
  authenticatedAt: new Date("2026-01-01T00:00:00.000Z"),
  assuranceLevel: ActorAssuranceLevel.Standard,
  staffMemberId: "staff-1",
  effectiveGrants: {
    permissions: new Set<Permission>([Permission.ATTACHMENT_CONFIGURE]),
    scopeGrants: [],
    scopeIdsByPermission: {},
    isElevated: false,
  },
});

describe("file upload intent route", () => {
  it("creates a presigned upload intent for authenticated staff", async () => {
    const expiresAt = new Date("2026-07-07T13:00:00.000Z");
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = baseEnv;
      c.set("actor", staffWithAttachmentConfigure);
      c.set("schoolApp", {
        repositories: {
          staffMembers: {
            findById: async (id: string) => (
              id === "staff-1" ? { id, schoolId: "school-1" } : undefined
            ),
          },
        },
        fileStorage: {
          createPresignedUpload: async () => ({
            uploadUrl: "https://storage.example/upload",
            expiresAt,
            headers: { "x-amz-acl": "private" },
          }),
        },
      } as never);
      await next();
    });
    app.route("/", indexRouter);

    const res = await app.request("/core/files/upload-intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerKind: AttachmentOwnerKind.Staff,
        ownerId: "staff-1",
        fileName: "profile.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 2048,
      }),
    });
    const body = await res.json() as {
      attachmentId: string;
      storageKey: string;
      uploadUrl: string;
      status: string;
    };

    expect(res.status).toBe(200);
    expect(body.status).toBe("pending_upload");
    expect(body.uploadUrl).toBe("https://storage.example/upload");
    expect(body.storageKey).toContain("school-1/uploads/staff/staff-1/");
  });

  it("returns 401 when no actor is present", async () => {
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = baseEnv;
      c.set("actor", null);
      c.set("schoolApp", { repositories: {}, fileStorage: {} } as never);
      await next();
    });
    app.route("/", indexRouter);

    const res = await app.request("/core/files/upload-intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerKind: AttachmentOwnerKind.Staff,
        ownerId: "staff-1",
        fileName: "profile.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 2048,
      }),
    });

    expect(res.status).toBe(401);
  });
});
