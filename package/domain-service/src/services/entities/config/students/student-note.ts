import type { ActorMetadata, AuthorizationPolicy } from '@edaya/authorization'
import type { StudentNote } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityWriteAuthorization } from '../../entity-config'
import { actorHasSchoolWideGrant, denyResourceAccess, LogbookOperations, StudentOperations } from '@edaya/authorization'
import { Permission, StudentNoteVisibility } from '@edaya/core'
import { authorizeDeleteByReadAccess, config, operationModule, read, readByIds, write } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/students/student-note.ts (PR3)
export const studentNoteConfig: EntityConfigFactory<StudentNote> = ({ repositories, policy, atomicExecution }) => {
  const readAccess = readByIds((actor, ids) => policy.checkStudentNoteAccess(actor, ids))

  return {
    ...config({
      repository: repositories.studentNotes,
      tenant: directSchoolTenant(),
      read: read(operationModule(StudentOperations.directoryRead), readAccess),
      write: write(
        operationModule(LogbookOperations.update),
        authorizeStudentNote(policy),
        authorizeDeleteByReadAccess(readAccess),
      ),
      atomicExecution,
    }),
    gates: {
      preSave: validateStudentNoteSave,
    },
  }
}

function authorizeStudentNote(policy: AuthorizationPolicy): EntityWriteAuthorization<StudentNote>['authorizeSave'] {
  return async (actor, entity, existing) => {
    await policy.checkStudentAccess(actor, [entity.studentId])
    if (existing)
      await policy.checkStudentNoteAccess(actor, [existing.id])
  }
}

export async function validateStudentNoteSave(
  note: StudentNote,
  existing: StudentNote | undefined,
  repositories: SchoolRepositories,
  actor: ActorMetadata,
): Promise<void> {
  const student = await repositories.students.findById(note.studentId)
  if (!student || student.schoolId !== note.schoolId) {
    denyResourceAccess()
  }
  const staffActorId = requireStaffActorId(actor)
  if (note.visibility === StudentNoteVisibility.AdminOnly && !hasFullStudentRecordAccess(actor)) {
    denyResourceAccess()
  }
  if (existing) {
    if (existing.schoolId !== note.schoolId || existing.studentId !== note.studentId || existing.authorStaffId !== note.authorStaffId) {
      denyResourceAccess()
    }
    if (existing.authorStaffId !== staffActorId && !hasFullStudentRecordAccess(actor)) {
      denyResourceAccess()
    }
  }
}

function requireStaffActorId(actor: ActorMetadata): string {
  if (!('staffMemberId' in actor)) {
    denyResourceAccess()
  }
  return actor.staffMemberId
}

function hasFullStudentRecordAccess(actor: ActorMetadata): boolean {
  return actorHasSchoolWideGrant(
    actor,
    [Permission.QUERY_STUDENT_DETAIL_READ],
  )
}
