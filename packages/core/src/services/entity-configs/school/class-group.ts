import type { ClassGroup } from '../../../entities/school/class-group'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import { denyResourceAccess } from '../../../authorization'
import { StudentClassEnrollmentStatus } from '../../../entities'
import { CalendarEventScopeKind } from '../../../entities/scheduling/calendar-event'
import { directEntityConfig, readByIds } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

export const classGroupConfig: EntityConfigFactory<ClassGroup> = (input) => {
  const config = directEntityConfig(
    input,
    input.repositories.classGroups,
    'queries.read_class_directory',
    'setup.manage',
    readByIds((actor, ids) => input.policy.checkClassGroupAccess(actor, ids)),
  )
  return {
    ...config,
    gates: {
      preSave: validateClassGroupSave,
      preDelete: validateClassGroupDelete,
    },
  }
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

async function validateClassGroupDelete(
  classGroup: ClassGroup,
  repositories: SchoolRepositories,
): Promise<void> {
  const [enrollments, classSubjects, sessions, schedules, assessments, incidents, resourceAssignments, calendarEvents] = await Promise.all([
    repositories.enrollments.list({ classGroupId: classGroup.id }),
    repositories.classSubjects.list({ classGroupId: classGroup.id }),
    repositories.sessions.list({ classGroupId: classGroup.id }),
    repositories.schedules.list({ classGroupId: classGroup.id }),
    repositories.assessments.list({ classGroupId: classGroup.id }),
    repositories.incidents.list({ classGroupId: classGroup.id }),
    repositories.resourceAssignments.list({ classGroupId: classGroup.id }),
    repositories.calendarEvents.list({ scopeKind: CalendarEventScopeKind.ClassGroup, scopeId: classGroup.id }),
  ])
  if (
    enrollments.length > 0
    || classSubjects.length > 0
    || sessions.length > 0
    || schedules.length > 0
    || assessments.length > 0
    || incidents.length > 0
    || resourceAssignments.length > 0
    || calendarEvents.length > 0
  ) {
    throw new BusinessRuleViolationError('CLASS_GROUP_HAS_DEPENDENCIES', `Cannot delete class group ${classGroup.id}: dependent records still exist`)
  }
}
