import { StaffRoleAssignment } from "@edaya/core";
import { buildDemoLoginAccounts, resolveDemoStaffRole } from "@/lib/demo-accounts";
import { describe, expect, it } from "bun:test";

const roleAssignments = [
  new StaffRoleAssignment({
    id: "sra-st5",
    staffId: "st5",
    schoolId: "sch-edaya-central",
    academicYearId: "2025",
    roleIds: ["role-director"],
    scopeGrants: [],
    status: "active",
  }),
  new StaffRoleAssignment({
    id: "sra-st1",
    staffId: "st1",
    schoolId: "sch-edaya-central",
    academicYearId: "2025",
    roleIds: ["role-teacher"],
    scopeGrants: [],
    status: "active",
  }),
  new StaffRoleAssignment({
    id: "sra-st2",
    staffId: "st2",
    schoolId: "sch-edaya-central",
    academicYearId: "2025",
    roleIds: ["role-teacher"],
    scopeGrants: [],
    status: "active",
  }),
  new StaffRoleAssignment({
    id: "sra-st3",
    staffId: "st3",
    schoolId: "sch-edaya-central",
    academicYearId: "2025",
    roleIds: ["role-coordinator"],
    scopeGrants: [],
    status: "active",
  }),
  new StaffRoleAssignment({
    id: "sra-st7",
    staffId: "st7",
    schoolId: "sch-edaya-central",
    academicYearId: "2025",
    roleIds: ["role-educator"],
    scopeGrants: [],
    status: "active",
  }),
];

const linkedStaff = [
  { id: "st5", email: "c.moreau@school.edu", name: "Camille Moreau", subjectId: "auth-st5" },
  { id: "st1", email: "m.dupont@school.edu", name: "Mme Dupont", subjectId: "auth-st1" },
  { id: "st2", email: "m.garnier@school.edu", name: "M. Garnier", subjectId: "auth-st2" },
  { id: "st3", email: "m.leon@school.edu", name: "Mme Léon", subjectId: "auth-st3" },
  { id: "st7", email: "t.evrard@school.edu", name: "Tom Évrard", subjectId: "auth-st7" },
  { id: "st4", email: "m.cheng@school.edu", name: "M. Cheng" },
];

describe("demo login account roles", () => {
  it("resolves demo staff roles from access role assignments", () => {
    expect(resolveDemoStaffRole("st5", roleAssignments)).toMatchObject({
      role: "directeur",
      accessRoleId: "role-director",
    });
    expect(resolveDemoStaffRole("st3", roleAssignments)).toMatchObject({
      role: "prof_principal",
      accessRoleId: "role-coordinator",
    });
    expect(resolveDemoStaffRole("st7", roleAssignments)).toMatchObject({
      role: "educateur",
      accessRoleId: "role-educator",
    });
    expect(resolveDemoStaffRole("st1", roleAssignments)).toMatchObject({
      role: "professeur",
      accessRoleId: "role-teacher",
    });
  });

  it("builds four login accounts with one teacher representative", () => {
    const accounts = buildDemoLoginAccounts(linkedStaff, roleAssignments);

    expect(accounts).toHaveLength(4);
    expect(accounts.map(account => account.staffId)).toEqual(["st5", "st1", "st3", "st7"]);
    expect(accounts.find(account => account.staffId === "st5")).toMatchObject({
      role: "directeur",
      email: "c.moreau@school.edu",
    });
    expect(accounts.find(account => account.staffId === "st7")).toMatchObject({
      role: "educateur",
      email: "t.evrard@school.edu",
    });
    expect(accounts.some(account => account.staffId === "st2")).toBe(false);
    expect(accounts.some(account => account.staffId === "st4")).toBe(false);
  });
});
