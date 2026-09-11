import { describe, expect, it } from "bun:test";
import { parseEnv } from "@/runtime";
import { Attachment, AttachmentOwnerKind, AttachmentStatus, Permission } from "@edaya/core";
import { ActorAssuranceLevel } from "@edaya/authorization";
import type { AppBindings } from "@/http/types";
import indexRouter from "@/app-router";
import { Hono } from "hono";

const baseEnv = parseEnv({
  RUNTIME: "in-memory",
  NODE_ENV: "test",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgres://admin:admin@localhost:5432/test_db",
});

describe("file content route", () => {
  it("denies anonymous access to profile images", async () => {
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
    expect(res.status).toBe(401);
    expect(res.headers.get("location")).toBeNull();
  });

  it("returns a direct download URL when the attachment only has fileUrl", async () => {
    const actor = {
      kind: "staff" as const,
      accountKind: "human" as const,
      actorId: "staff-1",
      subjectId: "admin-user",
      schoolId: "school-1",
      staffMemberId: "staff-1",
      effectiveGrants: {
        permissions: new Set<Permission>([Permission.ATTACHMENT_READ]),
        scopeGrants: [],
        scopeIdsByPermission: {},
        isElevated: false,
      },
      requestId: "request-id",
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Standard,
    };
    const attachment = new Attachment({
      id: "att-2",
      schoolId: "school-1",
      ownerKind: AttachmentOwnerKind.Staff,
      ownerId: "staff-1",
      fileName: "notes.pdf",
      fileUrl: "https://cdn.example/notes.pdf",
      status: AttachmentStatus.Ready,
      mimeType: "application/pdf",
      sizeBytes: 100,
    });

    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = baseEnv;
      c.set("actor", actor);
      c.set("schoolApp", {
        repositories: {
          attachments: {
            findById: async (id: string) => (id === attachment.id ? attachment : undefined),
          },
        },
        fileStorage: {
          createPresignedDownload: async () => {
            throw new Error("should not presign when fileUrl is present");
          },
        },
        forActor: () => ({
          baseService: {
            authorizationPolicy: {
              checkAttachmentAccess: async () => undefined,
            },
          },
        }),
      } as never);
      await next();
    });
    app.route("/", indexRouter);

    const res = await app.request("/core/files/att-2/download-url");
    const body = await res.json() as { downloadUrl: string };

    expect(res.status).toBe(200);
    expect(body.downloadUrl).toBe("https://cdn.example/notes.pdf");
  });
});
