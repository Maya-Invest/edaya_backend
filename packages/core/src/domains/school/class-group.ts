import type { SchoolRepositories } from '../../ports'
import type { EntityConfigFactory } from '../../shared'
import { denyResourceAccess, Permission } from '../../authorization'
import { CalendarEventScopeKind, StudentClassEnrollmentStatus } from '../../domains'
import { directPermissionEntityConfig, readByIds } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireNonBlank, requireOptionalNonBlank, requirePositiveInt } from '../utils'

export enum AttendanceMode {
  Daily = 'daily',
  Session = 'session',
}

export interface ClassGroupArgs {
  id: string
  schoolId: string
  academicYearId: string
  gradeLevelId: string
  name: string
  capacity?: number | null
  attendanceMode?: AttendanceMode
  homeroomStaffId?: string | null
  createdAt?: Date
}

/**
 * Represents an academic class group where students are enrolled.
 * Examples include "Grade 10A" or "Form 4 Science".
 * References a GradeLevel for structured level tracking.
 */
export class ClassGroup {
  readonly id: string
  readonly schoolId: string
  readonly academicYearId: string
  readonly gradeLevelId: string
  readonly name: string
  readonly capacity?: number
  readonly attendanceMode: AttendanceMode
  readonly homeroomStaffId?: string
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    academicYearId,
    gradeLevelId,
    name,
    capacity,
    attendanceMode = AttendanceMode.Session,
    homeroomStaffId,
    createdAt,
  }: ClassGroupArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.gradeLevelId = requireNonBlank(gradeLevelId, 'gradeLevelId')
    this.name = requireNonBlank(name, 'name')
    if (capacity != null) {
      this.capacity = requirePositiveInt(capacity, 'capacity')
    }
    this.attendanceMode = attendanceMode
    this.homeroomStaffId = requireOptionalNonBlank(homeroomStaffId, 'homeroomStaffId')
    this.createdAt = createdAt ?? new Date()
  }

  copyWith(changes: Partial<ClassGroupArgs>): ClassGroup {
    return new ClassGroup({
      id: this.id,
      schoolId: this.schoolId,
      academicYearId: this.academicYearId,
      gradeLevelId: this.gradeLevelId,
      name: this.name,
      capacity: this.capacity,
      attendanceMode: this.attendanceMode,
      homeroomStaffId: this.homeroomStaffId,
      createdAt: this.createdAt,
      ...changes,
    })
  }
}

export const classGroupConfig: EntityConfigFactory<ClassGroup> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.classGroups,
    Permission.QUERY_CLASS_DIRECTORY_READ,
    Permission.SCHOOL_STRUCTURE_CONFIGURE,
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
