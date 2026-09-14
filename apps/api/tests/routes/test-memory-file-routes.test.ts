import { PostgresCommandJournal } from "@edaya/adaptor-postgres";
import { describe, expect, it } from "bun:test";
import { AttachmentOwnerKind, createInMemoryFileStorage, noOpNotificationGateway, School, StaffMember } from "@edaya/core";
import { parseEnv } from "@/runtime";
import type { AppBindings } from "@/http/types";
import indexRouter from "@/app-router";
import { Hono } from "hono";
import { ApiSchoolApplication } from "@/lib/school-api/application";
import { createStaffActorMetadata } from "@edaya/authorization";
import { createAttachmentUpload } from "@edaya/service";
import { createAuthorizationDatabase } from "../../../../package/adaptor-postgres/tests/support/authorization-database";

const localEnv = parseEnv({
  RUNTIME: "in-memory",
  NODE_ENV: "test",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgres://admin:admin@localhost:5432/test_db",
});

const workerEnv = parseEnv({
  ...localEnv,
  RUNTIME: "worker",
});

describe("memory file storage routes", () => {
  it("requires an issued staging capability and authenticated access to accepted bytes", async () => {
    const fixture = await createAuthorizationDatabase();
    try {
      const actor = createStaffActorMetadata({ schoolId: "school-a", staffMemberId: "file-owner", subjectId: "file-owner-subject", requestId: "upload", authenticatedAt: new Date() });
      await fixture.repositories.schools.save(new School({ id: "school-a", name: "Files", timeZone: "UTC", ownerSubjectId: actor.subjectId }));
      await fixture.repositories.staffMembers.save(new StaffMember({ id: actor.staffMemberId, schoolId: "school-a", subjectId: actor.subjectId, firstName: "File", lastName: "Owner" }));
      const fileStorage = createInMemoryFileStorage();
      const school = new ApiSchoolApplication({ repositories: fixture.repositories, atomicExecution: fixture.atomic, commandJournal: new PostgresCommandJournal(), notificationGateway: noOpNotificationGateway, fileStorage });
      let authenticated = true;
      const app = new Hono<AppBindings>();
      app.use(async (c, next) => {
        c.env = localEnv;
        c.set("schoolApp", school);
        c.set("actor", authenticated ? actor : null);
        await next();
      });
      app.route("/", indexRouter);
      const payload = new TextEncoder().encode("%PDF-1.7\nFixture only\n%%EOF");
      const input = { ownerKind: AttachmentOwnerKind.Staff, ownerId: actor.staffMemberId, fileName: "sample.pdf", mimeType: "application/pdf", sizeBytes: payload.byteLength };
      const intent = await createAttachmentUpload(school.forActor(actor).baseService, input);
      const put = (key: string) => app.request(`/core/files/memory/${encodeURIComponent(key)}`, { method: "PUT", headers: { "Content-Type": input.mimeType }, body: payload });
      expect((await put("unissued/key")).status).toBe(404);
      for (const size of [payload.byteLength - 1, payload.byteLength + 1]) {
        const rejected = await app.request(`/core/files/memory/${encodeURIComponent(intent.storageKey)}`, { method: "PUT", headers: { "Content-Type": input.mimeType }, body: new Uint8Array(size) });
        expect(rejected.status).toBe(409);
        expect(await rejected.json()).toMatchObject({ code: "ATTACHMENT_SIZE_MISMATCH" });
        expect(await fileStorage.headObject(intent.storageKey)).toBeNull();
      }
      expect((await put(intent.storageKey)).status).toBe(204);
      const attachment = await school.forActor(actor).setupWorkflow.registerAttachment({ ...input, id: intent.attachmentId, schoolId: actor.schoolId, storageKey: intent.storageKey });
      expect((await put(intent.storageKey)).status).toBe(404);
      expect((await put(attachment.storageKey!)).status).toBe(404);
      const contentUrl = `/core/files/memory/${encodeURIComponent(attachment.storageKey!)}`;
      const downloaded = await app.request(contentUrl);
      expect(downloaded.status).toBe(200);
      expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(new Uint8Array(payload));
      authenticated = false;
      expect((await app.request(contentUrl)).status).toBe(401);
    }
    finally {
      await fixture.db.close();
    }
  });

  it("returns 404 when memory storage is unavailable on worker runtime", async () => {
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = workerEnv;
      c.set("schoolApp", { fileStorage: createInMemoryFileStorage() } as never);
      await next();
    });
    app.route("/", indexRouter);

    const res = await app.request("/core/files/memory/school-1%2Fmissing.bin");
    expect(res.status).toBe(404);
  });
});
