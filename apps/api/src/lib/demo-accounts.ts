import type { SchoolRepositories, StaffRoleAssignment } from "@edaya/core";

export type DemoStaffRole = "directeur" | "prof_principal" | "professeur" | "educateur";

export interface DemoLoginAccount {
  staffId: string;
  email: string;
  name: string;
  role: DemoStaffRole;
  initials: string;
}

export interface DemoLoginStaffSource {
  id: string;
  email?: string;
  name: string;
  subjectId?: string;
}

const ACCESS_ROLE_TO_DEMO_ROLE: Record<string, DemoStaffRole> = {
  "role-director": "directeur",
  "role-coordinator": "prof_principal",
  "role-educator": "educateur",
  "role-teacher": "professeur",
};

const DEMO_ROLE_DISPLAY_ORDER: Record<DemoStaffRole, number> = {
  directeur: 0,
  professeur: 1,
  prof_principal: 2,
  educateur: 3,
};

export function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export function resolveDemoStaffRole(
  staffId: string,
  roleAssignments: readonly StaffRoleAssignment[],
): { role: DemoStaffRole; accessRoleId?: string } {
  const assignment = roleAssignments.find(
    entry => entry.staffId === staffId && entry.status === "active",
  );
  const accessRoleId = assignment?.roleIds[0];
  const role = accessRoleId && ACCESS_ROLE_TO_DEMO_ROLE[accessRoleId]
    ? ACCESS_ROLE_TO_DEMO_ROLE[accessRoleId]
    : "professeur";

  return { role, accessRoleId };
}

export function buildDemoLoginAccounts(
  staffMembers: readonly DemoLoginStaffSource[],
  roleAssignments: readonly StaffRoleAssignment[],
): DemoLoginAccount[] {
  let teacherAccountIncluded = false;

  const accounts = staffMembers.flatMap((member) => {
    if (!member.subjectId || !member.email) {
      return [];
    }

    const { role, accessRoleId } = resolveDemoStaffRole(member.id, roleAssignments);
    if (!accessRoleId) {
      return [];
    }

    if (accessRoleId === "role-teacher") {
      if (teacherAccountIncluded) {
        return [];
      }
      teacherAccountIncluded = true;
    }

    return [{
      staffId: member.id,
      email: member.email,
      name: member.name,
      role,
      initials: initialsForName(member.name),
    }];
  });

  return accounts.sort((left, right) => {
    const roleOrder = DEMO_ROLE_DISPLAY_ORDER[left.role] - DEMO_ROLE_DISPLAY_ORDER[right.role];
    if (roleOrder !== 0) {
      return roleOrder;
    }
    return left.name.localeCompare(right.name, "fr");
  });
}

export async function loadDemoLoginAccounts(
  repositories: SchoolRepositories,
): Promise<DemoLoginAccount[]> {
  const [staffMembers, roleAssignments] = await Promise.all([
    repositories.staffMembers.list({}),
    repositories.staffRoleAssignments.list({}),
  ]);

  return buildDemoLoginAccounts(
    staffMembers.map(member => ({
      id: member.id,
      email: member.email,
      name: member.fullName,
      subjectId: member.subjectId,
    })),
    roleAssignments,
  );
}
