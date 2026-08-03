import { describe, expect, it } from "bun:test";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { registerSchoolWithOwner } from "@/lib/onboarding/register-school-with-owner";
import { StaffMember } from "@edaya/core";
import { createInMemoryTestApp } from "../../../../package/domain-service/tests/support/create-test-app";

function asApiApp(mem: ReturnType<typeof createInMemoryTestApp>): ApiSchoolApplication {
  const fullRepositories = (mem.app as { baseService?: { repositories: ApiSchoolApplication["repositories"] } })
    .baseService
    ?.repositories
    ?? mem.repositories as unknown as ApiSchoolApplication["repositories"];

  return {
    repositories: fullRepositories,
    forActor: mem.forActor,
  } as ApiSchoolApplication;
}

describe("registerSchoolWithOwner", () => {
  it("assigns the caller as school owner", async () => {
    const mem = createInMemoryTestApp();
    const application = asApiApp(mem);

    const result = await registerSchoolWithOwner(application, {
      user: { id: "subject-1", email: "admin@school.edu", name: "Admin User" },
    }, {
      name: "École Self",
      timeZone: "Africa/Abidjan",
      requestId: "req-1",
    });

    expect(result.school.ownerSubjectId).toBe("subject-1");
    expect(result.school.pendingOwnerStaffId).toBeUndefined();
  });

  it("rejects when the subject is already linked", async () => {
    const mem = createInMemoryTestApp();
    const application = asApiApp(mem);

    await application.repositories.staffMembers.save(new StaffMember({
      id: "staff-existing",
      schoolId: "sch-existing",
      firstName: "Existing",
      lastName: "Staff",
      subjectId: "subject-2",
      email: "admin@school.edu",
      isActive: true,
    }));

    await expect(registerSchoolWithOwner(application, {
      user: { id: "subject-2", email: "admin@school.edu", name: "Admin User" },
    }, {
      name: "École Conflict",
      timeZone: "Africa/Abidjan",
      requestId: "req-2",
    })).rejects.toMatchObject({ code: "SUBJECT_ALREADY_LINKED" });
  });
});
