import type { AppBindings } from "@/http/types";
import { postScopeSelectionsRenderHandler, postScopeSelectionsRenderRoute } from "@/routes/authorization.routes";
import { ActorAssuranceLevel, AuthorizationError, AuthorizationErrorCode, createStaffActorMetadata } from "@edaya/authorization";
import { OpenAPIHono } from "@hono/zod-openapi";
import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { createAuthorizationDatabase } from "../../../../package/adaptor-postgres/tests/support/authorization-database";

let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>;
beforeAll(async () => {
  fixture = await createAuthorizationDatabase();
});
afterAll(async () => {
  await fixture.db.close();
});

function appFor(mode: "allowed" | "denied" | "anonymous") {
  const assertRead = mock(async () => {
    if (mode === "denied")
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden, "Access denied");
  });
  const app = new OpenAPIHono<AppBindings>();
  app.use(async (c, next) => {
    c.set("actor", mode === "anonymous"
      ? null
      : createStaffActorMetadata({
          schoolId: "school-a",
          staffMemberId: "staff-a",
          subjectId: "person-a",
          requestId: "scope-labels",
          authenticatedAt: new Date(),
          assuranceLevel: ActorAssuranceLevel.Verified,
        }));
    c.set("schoolApp", { forActor: () => ({ baseService: {
      repositories: fixture.repositories,
      access: { staffPermissions: { assertRead } },
    } }) } as never);
    await next();
  });
  app.openapi(postScopeSelectionsRenderRoute, postScopeSelectionsRenderHandler);
  return { app, assertRead };
}

const payload = { academicYearId: "year-a", scopes: [{ kind: "school" }, { kind: "class_group", classGroupId: "class-a" }] };
function request(app: ReturnType<typeof appFor>["app"], body: unknown = payload) {
  return app.request("/core/authorization/scope-selections/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

test("labels mixed default selections behind the access-control read gate", async () => {
  const { app, assertRead } = appFor("allowed");
  const response = await request(app);
  expect(response.status).toBe(200);
  expect(assertRead).toHaveBeenCalledTimes(1);
  expect(await response.json() as { scopes: unknown[] }).toEqual({ scopes: [
    { scope: { kind: "school" }, label: "School", missing: false },
    { scope: { kind: "class_group", classGroupId: "class-a" }, label: "A", missing: false },
  ] });
  expect((await request(app, { academicYearId: "year-a", scopes: [] })).status).toBe(200);
  expect((await request(app, { academicYearId: "year-b", scopes: [] })).status).toBe(403);
  expect((await request(app, { academicYearId: "year-a", scopes: [{ kind: "class_group" }] })).status).toBe(400);
});

test("rejects anonymous and denied callers", async () => {
  const anonymous = appFor("anonymous");
  expect((await request(anonymous.app)).status).toBe(401);
  expect(anonymous.assertRead).not.toHaveBeenCalled();
  expect((await request(appFor("denied").app)).status).toBe(403);
});
