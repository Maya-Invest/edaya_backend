import type { StaffRoleAssignment } from "@edaya/core";
import { DEV_AUTH_STAFF_ACCOUNTS } from "@edaya/dev-fixtures";

export type DemoStaffRole = "directeur" | "prof_principal" | "professeur" | "educateur";

export interface DemoLoginAccount {
  staffId: string;
  email: string;
  name: string;
  role: DemoStaffRole;
  initials: string;
}

const ACCESS_ROLE_TO_DEMO_ROLE: Record<string, DemoStaffRole> = {
  "role-director": "directeur",
  "role-coordinator": "prof_principal",
  "role-educator": "educateur",
  "role-teacher": "professeur",
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
  roleAssignments: readonly StaffRoleAssignment[],
): DemoLoginAccount[] {
  let teacherAccountIncluded = false;

  return DEV_AUTH_STAFF_ACCOUNTS.flatMap((account) => {
    const { role, accessRoleId } = resolveDemoStaffRole(account.staffId, roleAssignments);
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
      staffId: account.staffId,
      email: account.email,
      name: account.name,
      role,
      initials: initialsForName(account.name),
    }];
  });
}
