import type { ApiSchoolApplication } from "@/lib/school-api/runtime/school-application";
import type { Environment } from "@/lib/bootstrap/env";
import type { AuthService } from "@/lib/runtime/types";
import { ensureAuthUser } from "@/lib/seed/auth-users";
import {
  DEV_AUTH_GUARDIAN_ACCOUNTS,
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_SCHOOL_ID,
} from "@edaya/dev-fixtures";
import { createSystemActorMetadata } from "@edaya/core";

export type DevAuthSeedResult =
  | { status: "skipped"; reason: "disabled" | "school-not-seeded" | "already-linked"; linkedStaff: number; linkedGuardians: number }
  | {
    status: "seeded";
    linkedStaff: number;
    linkedGuardians: number;
    accounts: Array<{ email: string; kind: "staff" | "guardian"; entityId: string }>;
  };

export async function runDevAuthSeed(
  application: ApiSchoolApplication,
  auth: AuthService,
  env: Environment,
): Promise<DevAuthSeedResult> {
  const school = await application.repositories.schools.findById(SEED_SCHOOL_ID);
  if (!school) {
    return { status: "skipped", reason: "school-not-seeded", linkedStaff: 0, linkedGuardians: 0 };
  }

  const actor = createSystemActorMetadata({
    systemId: "dev-auth-seed",
    schoolId: SEED_SCHOOL_ID,
    requestId: "dev-auth-seed",
    reason: "Link Better Auth users to seeded domain entities",
  });
  const service = application.forActor(actor);
  const linkedAccounts: Array<{ email: string; kind: "staff" | "guardian"; entityId: string }> = [];
  let linkedStaff = 0;
  let linkedGuardians = 0;

  for (const account of DEV_AUTH_STAFF_ACCOUNTS) {
    const staff = await application.repositories.staffMembers.findById(account.staffId);
    if (!staff) {
      continue;
    }

    const subjectId = await ensureAuthUser(auth, env, {
      email: account.email,
      password: DEV_AUTH_PASSWORD,
      name: account.name,
    });

    if (staff.subjectId === subjectId) {
      continue;
    }

    await service.linkActorSubject({
      subjectId,
      staffMemberId: account.staffId,
    });

    linkedStaff++;
    linkedAccounts.push({
      email: account.email,
      kind: "staff",
      entityId: account.staffId,
    });
  }

  for (const account of DEV_AUTH_GUARDIAN_ACCOUNTS) {
    const guardian = await application.repositories.guardians.findById(account.guardianId);
    if (!guardian) {
      continue;
    }

    const subjectId = await ensureAuthUser(auth, env, {
      email: account.email,
      password: DEV_AUTH_PASSWORD,
      name: account.name,
    });

    if (guardian.subjectId === subjectId) {
      continue;
    }

    await service.linkActorSubject({
      subjectId,
      guardianId: account.guardianId,
    });

    linkedGuardians++;
    linkedAccounts.push({
      email: account.email,
      kind: "guardian",
      entityId: account.guardianId,
    });
  }

  if (linkedStaff === 0 && linkedGuardians === 0) {
    return { status: "skipped", reason: "already-linked", linkedStaff: 0, linkedGuardians: 0 };
  }

  return {
    status: "seeded",
    linkedStaff,
    linkedGuardians,
    accounts: linkedAccounts,
  };
}
