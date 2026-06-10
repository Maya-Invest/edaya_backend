import { beforeEach, describe, expect, it } from "bun:test";
import { resetApiRuntimesForTests } from "@/lib/runtime/registry";
import {
  createAppRequest,
  createCoreRouteTestApp,
  seedDevSchoolAndAuthLinks,
  signInThroughApp,
} from "../support/better-auth-route-harness";

describe("better auth effective grants route", () => {
  beforeEach(() => {
    resetApiRuntimesForTests();
  });

  it("returns effective grants after sign-in through the app router", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    await seedDevSchoolAndAuthLinks(application, runtime);

    const cookies = await signInThroughApp(app, { email: "c.moreau@school.edu" });
    const staff = await application.repositories.staffMembers.findById("st5");

    const response = await app.request(createAppRequest("/api/core/authorization/effective-grants", {
      headers: {
        cookie: cookies.join("; "),
      },
    }));

    expect(response.status).toBe(200);

    const body = await response.json() as {
      kind: string;
      actorId: string;
      schoolId: string;
      assuranceLevel: string;
      effectiveGrants: {
        permissions: string[];
        scopeGrants: unknown[];
        isElevated: boolean;
      };
    };

    expect(body.kind).toBe("staff");
    expect(body.actorId).toBe("st5");
    expect(body.schoolId).toBe(staff?.schoolId);
    expect(body.assuranceLevel).toBe("standard");
    expect(Array.isArray(body.effectiveGrants.permissions)).toBe(true);
    expect(Array.isArray(body.effectiveGrants.scopeGrants)).toBe(true);
  }, 30_000);

  it("returns 401 when the session cookie is missing", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    await seedDevSchoolAndAuthLinks(application, runtime);

    const response = await app.request(createAppRequest("/api/core/authorization/effective-grants"));
    expect(response.status).toBe(401);
  }, 30_000);
});
