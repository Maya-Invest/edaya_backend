import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { ActorMetadata } from "@edaya/core";
import {
  AccessRole,
  COORDINATOR_PERMISSIONS,
  Permission,
  TEACHER_PERMISSIONS,
} from "@edaya/core";

export interface DefaultAccessRoleTemplate {
  id: string;
  name: string;
  description: string;
  permissions: readonly Permission[];
}

const WEBAPP_READ_PERMISSIONS: readonly Permission[] = [
  Permission.QUERY_WORKSPACE_READ,
  Permission.QUERY_CLASS_DIRECTORY_READ,
  Permission.QUERY_CLASS_CURRICULUM_READ,
  Permission.QUERY_STUDENT_DIRECTORY_READ,
  Permission.QUERY_OVERVIEW_READ,
  Permission.STAFF_READ,
  Permission.GRADE_READ,
  Permission.CLASS_LOGBOOK_READ,
  Permission.QUERY_TIMETABLE_READ,
  Permission.QUERY_CALENDAR_READ,
  Permission.QUERY_ATTENDANCE_READ,
  Permission.QUERY_STUDENT_DETAIL_READ,
];

const EDUCATOR_PERMISSIONS: readonly Permission[] = [
  Permission.DISCIPLINE_READ,
  Permission.DISCIPLINE_CREATE,
  Permission.ATTENDANCE_READ,
  Permission.ATTENDANCE_RECORD,
  Permission.CLASS_LOGBOOK_READ,
  Permission.GRADE_READ,
  Permission.STUDENT_READ,
];

function mergePermissions(...groups: readonly (readonly Permission[])[]): Permission[] {
  return [...new Set(groups.flat())];
}

export const DEFAULT_ACCESS_ROLE_TEMPLATES: readonly DefaultAccessRoleTemplate[] = [
  {
    id: "role-teacher",
    name: "Professeur",
    description: "Enseignement et suivi pédagogique",
    permissions: mergePermissions(TEACHER_PERMISSIONS, WEBAPP_READ_PERMISSIONS),
  },
  {
    id: "role-coordinator",
    name: "Coordination",
    description: "Profil principal, secrétariat et direction adjointe",
    permissions: mergePermissions(COORDINATOR_PERMISSIONS, WEBAPP_READ_PERMISSIONS, [
      Permission.ACCESS_CONTROL_READ,
      Permission.SCHOOL_STRUCTURE_CONFIGURE,
    ]),
  },
  {
    id: "role-educator",
    name: "CPE / Vie scolaire",
    description: "Discipline, absences et suivi des élèves",
    permissions: mergePermissions(EDUCATOR_PERMISSIONS, WEBAPP_READ_PERMISSIONS),
  },
  {
    id: "role-director",
    name: "Direction",
    description: "Administration complète de l'établissement",
    permissions: mergePermissions(COORDINATOR_PERMISSIONS, WEBAPP_READ_PERMISSIONS, [
      Permission.ACCESS_CONTROL_READ,
      Permission.ACCESS_CONTROL_CONFIGURE,
      Permission.ACCESS_CONTROL_ASSIGN,
      Permission.FINANCIAL_CONFIG_READ,
      Permission.PAYMENT_READ,
    ]),
  },
];

export async function ensureDefaultAccessRoles(
  application: ApiSchoolApplication,
  actor: ActorMetadata,
): Promise<void> {
  const schoolId = actor.schoolId;
  const service = application.forActor(actor);
  const existing = await application.repositories.accessRoles.list({ schoolId });
  const existingIds = new Set(existing.map(role => role.id));

  for (const template of DEFAULT_ACCESS_ROLE_TEMPLATES) {
    if (existingIds.has(template.id)) {
      continue;
    }

    await service.baseService.entities.accessRoles.save(new AccessRole({
      id: template.id,
      schoolId,
      name: template.name,
      description: template.description,
      permissions: [...template.permissions],
      status: "active",
    }), { moduleChecked: true });
  }
}
