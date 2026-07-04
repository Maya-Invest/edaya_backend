import type { SchoolRepositories } from '../../../../ports/repositories/school-repositories'
import type { ActorMetadata } from '../../model/actor'
import {
  actorGrantCoversAny,
  actorGrantCoversAnyResourcePath,
  actorHasAnyPermission,
  actorHasSchoolWideGrant,
} from '../../grants/actor-grant-checks'
import { activeClassGroupIdsByStudent } from '../../grants/enrollment-scope'
import { AuthorizationError, AuthorizationErrorCode } from '../../model/errors'
import { Permission } from '../../permissions'
import { permissionDefinitions } from '../../permissions/permission-definitions'
import { resourcePathForClassGroup, resourcePathForStudent } from '../../scope/resolve-resource-path'
import {
  CLASS_GROUP_TEACHING_ACCESS_PERMISSIONS,
  GUARDIAN_ADMIN_ACCESS_PERMISSIONS,
  SCHOOL_WIDE_STUDENT_NOTE_ACCESS_PERMISSIONS,
  STUDENT_DIRECT_ACCESS_PERMISSIONS,
} from './permission-sets'

const STUDENT_SCOPED_DIRECT_ACCESS_PERMISSIONS = STUDENT_DIRECT_ACCESS_PERMISSIONS.filter(
  permission => permissionDefinitions[permission].scope === 'student',
)

export async function checkStudentAccess(
  actor: ActorMetadata,
  studentIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (studentIds.length === 0) {
    return
  }

  if (actor.kind === 'staff' && actorHasSchoolWideGrant(actor, STUDENT_DIRECT_ACCESS_PERMISSIONS)) {
    return
  }

  const uniqueStudentIds = [...new Set(studentIds)]
  const needsEnrollmentLookup: string[] = []

  for (const studentId of uniqueStudentIds) {
    const canAccessDirect = actorGrantCoversAnyResourcePath(
      actor,
      STUDENT_SCOPED_DIRECT_ACCESS_PERMISSIONS,
      resourcePathForStudent(studentId),
    ) || actorGrantCoversAny(
      actor,
      STUDENT_SCOPED_DIRECT_ACCESS_PERMISSIONS,
      'student',
      studentId,
    )

    if (canAccessDirect) {
      continue
    }

    needsEnrollmentLookup.push(studentId)
  }

  if (needsEnrollmentLookup.length === 0) {
    return
  }

  const classGroupByStudent = await activeClassGroupIdsByStudent(repos, needsEnrollmentLookup)

  for (const studentId of needsEnrollmentLookup) {
    const classGroupId = classGroupByStudent.get(studentId)
    if (!classGroupId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }

    const canAccessClass = actorGrantCoversAnyResourcePath(
      actor,
      CLASS_GROUP_TEACHING_ACCESS_PERMISSIONS,
      resourcePathForClassGroup(classGroupId),
    ) || actorGrantCoversAny(
      actor,
      CLASS_GROUP_TEACHING_ACCESS_PERMISSIONS,
      'class_group',
      classGroupId,
    )

    if (!canAccessClass) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}

export async function checkGuardianAccess(
  actor: ActorMetadata,
  guardianIds: readonly string[],
  _repos: SchoolRepositories,
): Promise<void> {
  if (guardianIds.length === 0) {
    return
  }

  for (const guardianId of guardianIds) {
    const isSelf = actor.kind === 'guardian' && actor.actorId === guardianId
    if (isSelf) {
      continue
    }

    const hasStaffPermission = actorHasSchoolWideGrant(
      actor,
      GUARDIAN_ADMIN_ACCESS_PERMISSIONS,
    )

    if (!hasStaffPermission) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}

export async function checkStudentNoteAccess(
  actor: ActorMetadata,
  noteIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (noteIds.length === 0) {
    return
  }

  if (actor.kind !== 'staff') {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const hasGeneral = actorHasSchoolWideGrant(
    actor,
    SCHOOL_WIDE_STUDENT_NOTE_ACCESS_PERMISSIONS,
  )

  if (hasGeneral) {
    return
  }

  const notes = await repos.studentNotes.findByIds([...noteIds])
  if (notes.length !== noteIds.length) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const studentIds = [...new Set(notes.map(note => note.studentId))]
  await checkStudentAccess(actor, studentIds, repos)
}

export async function checkStudentHealthAccess(
  actor: ActorMetadata,
  profileIds: readonly string[],
  _repos: SchoolRepositories,
): Promise<void> {
  if (profileIds.length === 0) {
    return
  }

  const hasAccess = actorHasAnyPermission(actor, [
    Permission.STUDENT_HEALTH_READ,
    Permission.STUDENT_HEALTH_UPDATE,
  ])

  if (!hasAccess) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
