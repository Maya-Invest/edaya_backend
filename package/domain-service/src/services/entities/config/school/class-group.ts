import type { ClassGroup } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError, CalendarEventScopeKind, StudentClassEnrollmentStatus } from '@edaya/core'
import { classGradeBillingHooks } from '../../../../capabilities/finance/auto-billing-hooks'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/school/class-group.ts (PR3)
export const classGroupConfig: EntityConfigFactory<ClassGroup> = (context) => {
  const { repositories, atomicExecution } = context
  return config({
    repository: repositories.classGroups,
    tenant: directSchoolTenant(),
    resource: 'classGroups',
    writeLockGroup: 'academic-state',
    hooks: classGradeBillingHooks(context),

    gates: {
      preSave: validateClassGroupSave,
      preDelete: validateClassGroupDelete,
    },
    atomicExecution,
  })
}

export async function validateClassGroupSave(
  classGroup: ClassGroup,
  existing: ClassGroup | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [academicYear, gradeLevel, homeroomStaff] = await Promise.all([
    repositories.academicYears.findById(classGroup.academicYearId),
    repositories.gradeLevels.findById(classGroup.gradeLevelId),
    classGroup.homeroomStaffId ? repositories.staffMembers.findById(classGroup.homeroomStaffId) : Promise.resolve(undefined),
  ])
  if (!academicYear || academicYear.schoolId !== classGroup.schoolId) {
    denyResourceAccess()
  }
  if (!gradeLevel || gradeLevel.schoolId !== classGroup.schoolId) {
    denyResourceAccess()
  }
  if (classGroup.homeroomStaffId && (!homeroomStaff || homeroomStaff.schoolId !== classGroup.schoolId)) {
    denyResourceAccess()
  }
  if (existing && (existing.gradeLevelId !== classGroup.gradeLevelId || existing.academicYearId !== classGroup.academicYearId)
    && await repositories.classSubjects.count({ classGroupId: classGroup.id })) {
    throw new BusinessRuleViolationError('CLASS_GROUP_CURRICULUM_PLACEMENT_IMMUTABLE', 'A class with subject offerings cannot move to another grade or academic year')
  }
  if (existing && classGroup.capacity !== undefined) {
    const activeEnrollmentCount = await repositories.enrollments.count({
      classGroupId: classGroup.id,
      status: StudentClassEnrollmentStatus.Active,
    })
    if (classGroup.capacity < activeEnrollmentCount) {
      throw new BusinessRuleViolationError('CLASS_GROUP_CAPACITY_BELOW_ENROLLMENTS', `Class group ${classGroup.id} capacity cannot be below current active enrollment count`)
    }
  }
}

export async function validateClassGroupDelete(
  classGroup: ClassGroup,
  repositories: SchoolRepositories,
): Promise<void> {
  const [enrollments, classSubjects, classActivityEnrollments, lessonSessions, attendances, schedules, assessments, incidents, resourceAssignments, calendarEvents] = await Promise.all([
    repositories.enrollments.list({ classGroupId: classGroup.id }),
    repositories.classSubjects.list({ classGroupId: classGroup.id }),
    repositories.classActivityEnrollments.list({ classGroupId: classGroup.id }),
    repositories.lessonSessions.list({ classGroupId: classGroup.id }),
    repositories.attendances.list({ classGroupId: classGroup.id }),
    repositories.schedules.list({ classGroupId: classGroup.id }),
    repositories.assessments.list({ classGroupId: classGroup.id }),
    repositories.incidents.list({ classGroupId: classGroup.id }),
    repositories.resourceAssignments.list({ classGroupId: classGroup.id }),
    repositories.calendarEvents.list({ scopeKind: CalendarEventScopeKind.ClassGroup, scopeId: classGroup.id }),
  ])
  if (
    enrollments.length > 0
    || classSubjects.length > 0
    || classActivityEnrollments.length > 0
    || lessonSessions.length > 0
    || attendances.length > 0
    || schedules.length > 0
    || assessments.length > 0
    || incidents.length > 0
    || resourceAssignments.length > 0
    || calendarEvents.length > 0
  ) {
    throw new BusinessRuleViolationError('CLASS_GROUP_HAS_DEPENDENCIES', `Cannot delete class group ${classGroup.id}: dependent records still exist`)
  }
}
