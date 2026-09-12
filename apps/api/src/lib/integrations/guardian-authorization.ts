import type { GuardianActorMetadata } from "@edaya/authorization";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { randomUUID } from "node:crypto";
import { AuthorizationError, AuthorizationErrorCode, createGuardianActorMetadata } from "@edaya/authorization";
import { externalOAuthScopes } from "./scopes";

interface DelegationGrant {
  subjectId: string;
  schoolId: string;
  guardianId: string;
  studentIds: string[];
  createdAt: Date;
  scopes?: string[];
}

interface DelegationSelection {
  schoolId: string;
  studentIds: string[];
  scopes: string[];
}

interface DelegationAuthorization {
  authorizeSelection: (subjectId: string, selection: DelegationSelection) => Promise<{ guardianId: string }>;
  isGrantCurrent: (grant: DelegationGrant) => Promise<boolean>;
}

function denied(): never {
  throw new AuthorizationError(AuthorizationErrorCode.Forbidden);
}

/** Always reads current school state; staff elevation never enters this path. */
export function createGuardianDelegationAuthorization(getApplication: () => Promise<ApiSchoolApplication>): DelegationAuthorization & {
  resolveActor: (grant: DelegationGrant) => Promise<GuardianActorMetadata>;
} {
  async function resolveGuardian(subjectId: string, schoolId: string, guardianId?: string) {
    const { repositories } = await getApplication();
    const guardians = await repositories.guardians.list({ subjectId, schoolId, hasAccess: true, $limit: 2 });
    const guardian = guardians.length === 1 ? guardians[0] : undefined;
    if (!guardian || (guardianId && guardian.id !== guardianId) || !await repositories.schools.findById(schoolId)) {
      return denied();
    }
    const links = await repositories.guardianLinks.list({ schoolId, guardianId: guardian.id });
    // A corrupt cross-school relationship cannot grant access to the student.
    const students = await repositories.students.list({ schoolId, id: { $in: links.map(link => link.studentId) } });
    return { repositories, guardian, studentIds: new Set(students.map(student => student.id)) };
  }

  async function authorizeSelection(subjectId: string, selection: DelegationSelection) {
    if (!selection.studentIds.length || selection.studentIds.length > 100 || !selection.scopes.length
      || selection.scopes.some(scope => !externalOAuthScopes.includes(scope))
      || !selection.scopes.some(scope => scope !== "openid" && scope !== "offline_access")) {
      return denied();
    }
    const resolved = await resolveGuardian(subjectId, selection.schoolId);
    if (selection.studentIds.some(studentId => !resolved.studentIds.has(studentId))) {
      return denied();
    }
    return { guardianId: resolved.guardian.id };
  }

  async function resolveActor(grant: DelegationGrant): Promise<GuardianActorMetadata> {
    const { studentIds: linked } = await resolveGuardian(grant.subjectId, grant.schoolId, grant.guardianId);
    const studentIds = grant.studentIds.filter(id => linked.has(id));
    if (!studentIds.length) {
      return denied();
    }
    return createGuardianActorMetadata({
      subjectId: grant.subjectId,
      schoolId: grant.schoolId,
      guardianId: grant.guardianId,
      authenticatedAt: grant.createdAt,
      requestId: randomUUID(),
    });
  }

  return {
    authorizeSelection,
    resolveActor,
    async isGrantCurrent(grant) {
      try {
        await resolveActor(grant);
        return true;
      }
      catch (error) {
        if (error instanceof AuthorizationError) {
          return false;
        }
        throw error;
      }
    },
  };
}
