import { describe, expect, it } from "bun:test";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { assignConsortiumSchoolOwner } from "@/lib/consortium/assign-school-owner";
import { createConsortium } from "@/lib/consortium/consortium-service";
import { registerSchoolWithOwner } from "@/lib/onboarding/register-school-with-owner";
import { School, StaffMember } from "@edaya/core";
import { createInMemoryTestApp } from "../../../../package/domain-service/tests/support/create-test-app";

function asApiApp(mem: ReturnType<typeof createInMemoryTestApp>): ApiSchoolApplication {
  const fullRepositories = (mem.app as { baseService?: { repositories: ApiSchoolApplication["repositories"] } })
    .baseService
    ?.repositories
    ?? mem.repositories as ApiSchoolApplication["repositories"];

  return {
    repositories: fullRepositories,
    forActor: mem.forActor,
  } as ApiSchoolApplication;
}

describe("registerSchoolWithOwner owner assignment choices", () => {
  it("assigns the caller as owner when assignAsSchoolOwner is true", async () => {
    const mem = createInMemoryTestApp();
    const application = asApiApp(mem);
    const consortium = await createConsortium(application.repositories, {
      id: "cons-1",
      name: "Groupe",
      ownerSubjectId: "subject-1",
    });

    const result = await registerSchoolWithOwner(application, {
      user: { id: "subject-1", email: "admin@school.edu", name: "Admin User" },
    }, {
      name: "École Self",
      timeZone: "Africa/Abidjan",
      consortiumId: consortium.id,
      assignAsSchoolOwner: true,
      requestId: "req-1",
    });

    expect(result.school.ownerSubjectId).toBe("subject-1");
    expect(result.school.pendingOwnerStaffId).toBeUndefined();
  });

  it("leaves the school without owner when assignAsSchoolOwner is false", async () => {
    const mem = createInMemoryTestApp();
    const application = asApiApp(mem);
    const consortium = await createConsortium(application.repositories, {
      id: "cons-2",
      name: "Groupe",
      ownerSubjectId: "subject-2",
    });

    const result = await registerSchoolWithOwner(application, {
      user: { id: "subject-2", email: "admin@school.edu", name: "Admin User" },
    }, {
      name: "École Later",
      timeZone: "Africa/Abidjan",
      consortiumId: consortium.id,
      assignAsSchoolOwner: false,
      requestId: "req-2",
    });

    expect(result.school.ownerSubjectId).toBeUndefined();
    expect(result.school.consortiumId).toBe(consortium.id);
  });

  it("invites an owner email and stores pendingOwnerStaffId", async () => {
    const mem = createInMemoryTestApp();
    const application = asApiApp(mem);
    const consortium = await createConsortium(application.repositories, {
      id: "cons-3",
      name: "Groupe",
      ownerSubjectId: "subject-3",
    });

    const result = await registerSchoolWithOwner(application, {
      user: { id: "subject-3", email: "admin@school.edu", name: "Admin User" },
    }, {
      name: "École Invite",
      timeZone: "Africa/Abidjan",
      consortiumId: consortium.id,
      assignAsSchoolOwner: false,
      ownerInviteEmail: "future.owner@school.edu",
      inviteBaseUrl: "https://app.edaya.test/invite",
      requestId: "req-3",
    });

    expect(result.school.ownerSubjectId).toBeUndefined();
    expect(result.school.pendingOwnerStaffId).toBeTruthy();
    const pending = await application.repositories.staffMembers.findById(result.school.pendingOwnerStaffId!);
    expect(pending?.email).toBe("future.owner@school.edu");
  });
});

describe("assignConsortiumSchoolOwner", () => {
  it("assigns a linked staff subject as owner", async () => {
    const mem = createInMemoryTestApp();
    const application = asApiApp(mem);
    const consortium = await createConsortium(application.repositories, {
      id: "cons-4",
      name: "Groupe",
      ownerSubjectId: "admin-subject",
    });

    await application.repositories.schools.save(new School({
      id: "sch-4",
      name: "École",
      timeZone: "Africa/Abidjan",
      consortiumId: consortium.id,
    }));
    await application.repositories.staffMembers.save(new StaffMember({
      id: "staff-admin",
      schoolId: "sch-4",
      firstName: "Admin",
      lastName: "Group",
      subjectId: "admin-subject",
      email: "admin@school.edu",
      isActive: true,
    }));
    await application.repositories.staffMembers.save(new StaffMember({
      id: "staff-owner",
      schoolId: "sch-4",
      firstName: "School",
      lastName: "Owner",
      subjectId: "owner-subject",
      email: "owner@school.edu",
      isActive: true,
    }));

    const result = await assignConsortiumSchoolOwner(application, {
      consortiumId: consortium.id,
      schoolId: "sch-4",
      subjectId: "owner-subject",
      actorSubjectId: "admin-subject",
      requestId: "req-4",
    });

    expect(result.ownerStatus).toBe("assigned");
    expect(result.ownerSubjectId).toBe("owner-subject");
    const school = await application.repositories.schools.findById("sch-4");
    expect(school?.ownerSubjectId).toBe("owner-subject");
  });

  it("rejects assigning a subject who already owns another school", async () => {
    const mem = createInMemoryTestApp();
    const application = asApiApp(mem);
    const consortium = await createConsortium(application.repositories, {
      id: "cons-5",
      name: "Groupe",
      ownerSubjectId: "admin-subject",
    });

    await application.repositories.schools.save(new School({
      id: "sch-owned",
      name: "Owned",
      timeZone: "Africa/Abidjan",
      consortiumId: consortium.id,
      ownerSubjectId: "owner-subject",
    }));
    await application.repositories.schools.save(new School({
      id: "sch-target",
      name: "Target",
      timeZone: "Africa/Abidjan",
      consortiumId: consortium.id,
    }));
    await application.repositories.staffMembers.save(new StaffMember({
      id: "staff-admin",
      schoolId: "sch-target",
      firstName: "Admin",
      lastName: "Group",
      subjectId: "admin-subject",
      isActive: true,
    }));
    await application.repositories.staffMembers.save(new StaffMember({
      id: "staff-owner-target",
      schoolId: "sch-target",
      firstName: "School",
      lastName: "Owner",
      subjectId: "owner-subject",
      isActive: true,
    }));

    await expect(assignConsortiumSchoolOwner(application, {
      consortiumId: consortium.id,
      schoolId: "sch-target",
      subjectId: "owner-subject",
      actorSubjectId: "admin-subject",
      requestId: "req-5",
    })).rejects.toMatchObject({ code: "OWNER_SUBJECT_ALREADY_ASSIGNED" });
  });

  it("invites by email when the recipient is not linked yet", async () => {
    const mem = createInMemoryTestApp();
    const application = asApiApp(mem);
    const consortium = await createConsortium(application.repositories, {
      id: "cons-6",
      name: "Groupe",
      ownerSubjectId: "admin-subject",
    });

    await application.repositories.schools.save(new School({
      id: "sch-6",
      name: "École",
      timeZone: "Africa/Abidjan",
      consortiumId: consortium.id,
    }));
    await application.repositories.staffMembers.save(new StaffMember({
      id: "staff-admin",
      schoolId: "sch-6",
      firstName: "Admin",
      lastName: "Group",
      subjectId: "admin-subject",
      email: "admin@school.edu",
      isActive: true,
    }));

    const result = await assignConsortiumSchoolOwner(application, {
      consortiumId: consortium.id,
      schoolId: "sch-6",
      email: "invitee@school.edu",
      inviteBaseUrl: "https://app.edaya.test/invite",
      actorSubjectId: "admin-subject",
      requestId: "req-6",
    });

    expect(result.ownerStatus).toBe("pending_invite");
    expect(result.pendingOwnerStaffId).toBeTruthy();
  });
});
