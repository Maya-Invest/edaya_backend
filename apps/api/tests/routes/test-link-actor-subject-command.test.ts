import { beforeEach, describe, expect, it } from "bun:test";
import { resetApiRuntimesForTests } from "@/lib/runtime/registry";
import { SEED_SCHOOL_ID } from "@/lib/seed/dataset";
import { createSystemActorMetadata } from "@edaya/core";
import {
  createAppRequest,
  createCoreRouteTestApp,
  grantAccessControlAssign,
  seedDevSchoolAndAuthLinks,
  signInThroughApp,
  signUpAuthUser,
} from "../support/better-auth-route-harness";

const UNLINKED_STAFF_ID = "st9";

describe("link-actor-subject command route", () => {
  beforeEach(() => {
    resetApiRuntimesForTests();
  });

  it("links a staff member to a Better Auth subject through the command route", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    await seedDevSchoolAndAuthLinks(application, runtime);
    await grantAccessControlAssign(application, "st5");

    const systemActor = createSystemActorMetadata({
      systemId: "link-actor-subject-test",
      schoolId: SEED_SCHOOL_ID,
      requestId: "link-actor-subject-test",
      reason: "Register staff for link-actor-subject route test",
    });
    const service = application.forActor(systemActor);

    await service.registerStaffMember({
      id: UNLINKED_STAFF_ID,
      schoolId: SEED_SCHOOL_ID,
      firstName: "Paul",
      lastName: "Martin",
      email: "p.martin@school.edu",
    });

    const subjectId = await signUpAuthUser(runtime, {
      email: "p.martin@school.edu",
      name: "Paul Martin",
    });

    const cookies = await signInThroughApp(app, { email: "c.moreau@school.edu" });

    const response = await app.request(createAppRequest("/api/core/commands/link-actor-subject", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": cookies.join("; "),
      },
      body: JSON.stringify({
        subjectId,
        staffMemberId: UNLINKED_STAFF_ID,
      }),
    }));

    expect(response.status).toBe(200);

    const body = await response.json() as {
      kind: string;
      entity: {
        data: {
          id: string;
          subjectId: string;
        };
      };
    };

    expect(body.kind).toBe("staff");
    expect(body.entity.data.id).toBe(UNLINKED_STAFF_ID);
    expect(body.entity.data.subjectId).toBe(subjectId);

    const linkedStaff = await application.repositories.staffMembers.findById(UNLINKED_STAFF_ID);
    expect(linkedStaff?.subjectId).toBe(subjectId);
  }, 30_000);

  it("returns 401 when the caller is not authenticated", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    await seedDevSchoolAndAuthLinks(application, runtime);

    const response = await app.request(createAppRequest("/api/core/commands/link-actor-subject", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        subjectId: "auth-user-unauthenticated",
        staffMemberId: "st1",
      }),
    }));

    expect(response.status).toBe(401);
  }, 30_000);
});
