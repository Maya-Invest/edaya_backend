import type { AuthorizationPolicy } from '@edaya/authorization'
import type { TeacherUnavailability } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver, EntityWriteAuthorization } from '../../entity-config'
import { AccessControlOperations, TeacherOperations } from '@edaya/authorization'
import { BusinessRuleViolationError, TeacherUnavailabilityRecurrence } from '@edaya/core'
import { config, operationModule, read, write } from '../../entity-config'
import { indirectTenant } from '../../entity-config/tenant'

export const teacherUnavailabilityConfig: EntityConfigFactory<TeacherUnavailability> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.teacherUnavailabilities,
    tenant: teacherUnavailabilityTenant(),
    read: read(
      operationModule(TeacherOperations.selfRead),
      (actor, entities) => policy.checkTeacherAccess(actor, entities.map(entity => entity.teacherId)),
    ),
    write: write(
      operationModule(AccessControlOperations.assign),
      authorizeTeacherUnavailability(policy),
      authorizeTeacherUnavailabilityDelete(policy),
    ),
    gates: { preSave: validateTeacherUnavailabilitySave },
    atomicExecution,
  })

function teacherUnavailabilityTenant(): EntityTenantResolver<TeacherUnavailability> {
  return indirectTenant(async (entity, repositories) => {
    const teacher = await repositories.teachers.findById(entity.teacherId)
    return teacher?.schoolId
  })
}

function authorizeTeacherUnavailability(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<TeacherUnavailability>['authorizeSave'] {
  return async (actor, entity) => policy.checkTeacherAccess(actor, [entity.teacherId])
}

function authorizeTeacherUnavailabilityDelete(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<TeacherUnavailability>['authorizeDelete'] {
  return async (actor, entity) => policy.checkTeacherAccess(actor, [entity.teacherId])
}

export async function validateTeacherUnavailabilitySave(
  unavailability: TeacherUnavailability,
  _existing: TeacherUnavailability | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const teacher = await repositories.teachers.findById(unavailability.teacherId)
  if (!teacher) {
    throw new BusinessRuleViolationError('TEACHER_NOT_FOUND', `Teacher ${unavailability.teacherId} not found`)
  }
  const academicYear = await repositories.academicYears.findById(unavailability.academicYearId)
  if (!academicYear || academicYear.schoolId !== teacher.schoolId) {
    throw new BusinessRuleViolationError('ACADEMIC_YEAR_NOT_FOUND', `Academic year ${unavailability.academicYearId} not found in school`)
  }

  const effectiveStart = unavailability.recurrence === TeacherUnavailabilityRecurrence.Weekly
    ? unavailability.effectiveFrom!
    : unavailability.startsAt!
  const effectiveEnd = unavailability.recurrence === TeacherUnavailabilityRecurrence.Weekly
    ? unavailability.effectiveUntil!
    : unavailability.endsAt!
  const academicYearEndExclusive = new Date(academicYear.endDate)
  academicYearEndExclusive.setUTCDate(academicYearEndExclusive.getUTCDate() + 1)
  if (effectiveEnd <= academicYear.startDate || effectiveStart >= academicYearEndExclusive) {
    throw new BusinessRuleViolationError(
      'TEACHER_UNAVAILABILITY_OUTSIDE_ACADEMIC_YEAR',
      'Teacher unavailability must intersect its academic year',
    )
  }
}
