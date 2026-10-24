import { Buffer } from "node:buffer";
import type { AppBindings } from "@/http/types";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { createStaffActorMetadata } from "@edaya/authorization";
import { IMPORT_MAX_FILE_BYTES } from "@edaya/core";
import { expect, test } from "bun:test";
import { Hono } from "hono";
import importsRouter from "@/routes/imports.routes";
import { requestBodyLimit } from "@/http/middleware/request-body-limit";

function fixture(authenticated = true) {
  const received: unknown[] = [];
  const app = new Hono<AppBindings>();
  app.use(requestBodyLimit);
  const actor = createStaffActorMetadata({ schoolId: "school", staffMemberId: "staff", subjectId: "subject", requestId: "test", authenticatedAt: new Date() });
  app.use(async (c, next) => {
    c.set("actor", authenticated ? actor : null);
    c.set("schoolApp", { forActor: () => ({ imports: { create: async (input: unknown) => {
      received.push(input);
      return input;
    }, submit: async (input: unknown) => {
      received.push(input);
      return { accepted: true };
    } } }) } as unknown as ApiSchoolApplication);
    await next();
  });
  app.route("/", importsRouter);
  const request = (path: string, data: unknown) => app.request(`/core/imports/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  return { received, request };
}

test("import transport defaults the session to M and refuses per-file conflict settings", async () => {
  const f = fixture();
  expect((await f.request("create", { academicYearId: "year" })).status).toBe(200);
  expect(f.received[0]).toEqual({ academicYearId: "year", defaultOnExisting: "M" });
  const response = await f.request("submit", { batchId: "batch", type: "staff", fileName: "staff.csv", base64: "YQ==", defaultOnExisting: "S" });
  expect(response.status).toBe(422);
  expect(f.received).toHaveLength(1);
});
test("import admission requires authentication and rejects malformed payloads", async () => {
  expect((await fixture(false).request("create", { academicYearId: "year" })).status).toBe(401);
  expect((await fixture().request("create", { academicYearId: "year", defaultOnExisting: "merge" })).status).toBe(422);
  expect((await fixture().request("submit", { batchId: "batch", type: "staff", fileName: "staff.csv", base64: "%%%" })).status).toBe(409);
});

test("import upload allows a 5 MiB file with bounded base64 overhead without raising other endpoint limits", async () => {
  const f = fixture();
  const upload = { batchId: "batch", type: "staff", fileName: "staff.csv", base64: Buffer.alloc(IMPORT_MAX_FILE_BYTES, 97).toString("base64") };
  const accepted = await f.request("submit", upload);
  expect({ status: accepted.status, body: await accepted.json() }).toEqual({ status: 200, body: { accepted: true } });
  expect((f.received[0] as { bytes: Uint8Array }).bytes.byteLength).toBe(IMPORT_MAX_FILE_BYTES);
  expect((await f.request("submit", { ...upload, base64: `${upload.base64}${"A".repeat(8192)}` })).status).toBe(413);
  expect((await f.request("create", { academicYearId: "x".repeat(1024 * 1024) })).status).toBe(413);
  expect(f.received).toHaveLength(1);
});
