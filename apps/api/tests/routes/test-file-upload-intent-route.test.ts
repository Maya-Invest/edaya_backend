import type { AppBindings } from "@/http/types";
import indexRouter from "@/app-router";
import { parseEnv } from "@/runtime";
import { ActorAssuranceLevel, createStaffActorMetadata } from "@edaya/authorization";
import { AttachmentOwnerKind, noOpNotificationGateway, Permission, StaffPermissionAssignment } from "@edaya/core";
import { ApiSchoolApplication } from "@/lib/school-api/application";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createAuthorizationDatabase } from "../../../../package/adaptor-postgres/tests/support/authorization-database";

const baseEnv = parseEnv({ RUNTIME: "in-memory", NODE_ENV: "test", PORT: 9999, LOG_LEVEL: "silent", DATABASE_URL: "postgres://admin:admin@localhost:5432/test_db" });
const staff = createStaffActorMetadata({ schoolId: "school-a", subjectId: "person-a", staffMemberId: "staff-a", requestId: "upload", authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Standard });

describe("file upload intent with current authorization", () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>;
  let requests: number;
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase();
    requests = 0;
  });
  afterEach(async () => {
    await fixture.db.close();
  });

  function application(authenticated = true) {
    const unused = async (): Promise<never> => {
      throw new Error("Unexpected storage operation");
    };
    const school = new ApiSchoolApplication({
      repositories: fixture.repositories,
      atomicExecution: fixture.atomic,
      notificationGateway: noOpNotificationGateway,
      fileStorage: {
        putObject: unused,
        deleteObject: unused,
        headObject: unused,
        createPresignedDownload: unused,
        createPresignedUpload: async ({ key }) => {
          requests += 1;
          return { key, uploadUrl: "https://storage.example/upload", expiresAt: new Date("2026-12-01") };
        },
      },
    });
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = baseEnv;
      c.set("actor", authenticated ? staff : null);
      c.set("schoolApp", school);
      await next();
    });
    app.route("/", indexRouter);
    return app;
  }

  const upload = (app: ReturnType<typeof application>, ownerId = "staff-a") => app.request("/core/files/upload-intents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerKind: AttachmentOwnerKind.Staff, ownerId, fileName: "profile.jpg", mimeType: "image/jpeg", sizeBytes: 2048 }),
  });

  test("only an active attachment grant can issue an upload URL in its tenant", async () => {
    const app = application();
    expect((await upload(app)).status).toBe(403);
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: "upload", schoolId: "school-a", staffId: "staff-a", academicYearId: "year-a", permission: Permission.ATTACHMENT_CONFIGURE, scopes: [{ kind: "school" }] }));
    const res = await upload(app);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; uploadUrl: string; storageKey: string };
    expect(body.status).toBe("pending_upload");
    expect(body.uploadUrl).toBe("https://storage.example/upload");
    expect(body.storageKey).toContain("school-a/uploads/staff/staff-a/");
    expect((await upload(app, "staff-b")).status).toBe(403);
    await fixture.repositories.staffPermissionAssignments.delete("upload");
    expect((await upload(app)).status).toBe(403);
    expect(requests).toBe(1);
  });

  test("requires an authenticated actor before requesting storage credentials", async () => {
    expect((await upload(application(false))).status).toBe(401);
    expect(requests).toBe(0);
  });
});
