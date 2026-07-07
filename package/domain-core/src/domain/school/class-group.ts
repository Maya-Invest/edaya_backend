import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports'
import { z } from 'zod'
import {
  authorizeDeleteByReadAccess,
  authorizeExistingById,
  config,
  directSchoolTenant,
  operationModule,
  read,
  readByIds,
  write,
} from '../../application/entities/entity-config'
import { denyResourceAccess, SchoolStructureOperations } from '../../capabilities/authorization'
import { CalendarEventScopeKind, StudentClassEnrollmentStatus } from '../../domain'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { parseDomain, zodDate } from '../shared/utils'

export enum AttendanceMode {
  Daily = 'daily',
  Session = 'session',
}

export const classGroupSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  gradeLevelId: z.string().trim().min(1, 'gradeLevelId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  capacity: z.number().int('capacity must be a strictly positive integer').positive('capacity must be a strictly positive integer').nullable().optional().transform(v => v === null ? undefined : v),
  attendanceMode: z.nativeEnum(AttendanceMode).default(AttendanceMode.Session),
  homeroomStaffId: z.string().trim().min(1, 'homeroomStaffId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type ClassGroupData = z.infer<typeof classGroupSchema>
export type ClassGroupInput = z.input<typeof classGroupSchema>

export const classGroupCreateSchema = classGroupSchema.omit({ createdAt: true })
export const classGroupUpdateSchema = classGroupSchema.partial().required({ id: true })

/**
 * Represents an academic class group where students are enrolled.
 * Examples include "Grade 10A" or "Form 4 Science".
 * References a GradeLevel for structured level tracking.
 */
export class ClassGroup {
  readonly data: ClassGroupData

  constructor(args: ClassGroupInput) {
    this.data = parseDomain(classGroupSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get academicYearId() { return this.data.academicYearId }
  get gradeLevelId() { return this.data.gradeLevelId }
  get name() { return this.data.name }
  get capacity() { return this.data.capacity }
  get attendanceMode() { return this.data.attendanceMode }
  get homeroomStaffId() { return this.data.homeroomStaffId }
  get createdAt() { return this.data.createdAt }

  copyWith(changes: Partial<ClassGroupInput>): ClassGroup {
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

export const classGroupConfig: EntityConfigFactory<ClassGroup> = ({ repositories, policy, atomicExecution }) => {
  const readAccess = readByIds((actor, ids) => policy.checkClassGroupAccess(actor, ids))

  return config({
    repository: repositories.classGroups,
    tenant: directSchoolTenant(),
    read: read(operationModule(SchoolStructureOperations.classGroupRead), readAccess),
    write: write(
      operationModule(SchoolStructureOperations.configure),
      authorizeExistingById(readAccess),
      authorizeDeleteByReadAccess(readAccess),
    ),
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
