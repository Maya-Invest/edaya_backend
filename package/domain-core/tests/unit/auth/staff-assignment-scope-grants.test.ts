import type { StaffAssignment } from '../../../src/domain'
import { describe, expect, test } from 'bun:test'
import { Permission } from '../../../src/capabilities/authorization'
import { scopeGrantsFromStaffAssignments } from '../../../src/capabilities/authorization/grants/staff-assignment-scope'
import { StaffAssignment as StaffAssignmentEntity } from '../../../src/domain'

const assignmentScopedPermissions = [
  Permission.GRADE_INPUT,
  Permission.ATTENDANCE_RECORD,
  Permission.CLASS_LOGBOOK_CREATE,
  Permission.CLASS_LOGBOOK_UPDATE,
  Permission.DISCIPLINE_CREATE,
] as const

function assignment(input: ConstructorParameters<typeof StaffAssignmentEntity>[0]): StaffAssignment {
  return new StaffAssignmentEntity(input)
}

function assignmentWithoutScopeTargets(): StaffAssignment {
  return {
    classGroupId: undefined,
    classSubjectId: undefined,
    lessonSessionId: undefined,
    activitySessionId: undefined,
  } as StaffAssignment
}

describe('scopeGrantsFromStaffAssignments', () => {
  test('returns no grants when assignment scope targets are absent', () => {
    expect(scopeGrantsFromStaffAssignments([assignmentWithoutScopeTargets()])).toEqual([])
  })

  test('emits class group scoped grants for each assignment-scoped permission', () => {
    const grants = scopeGrantsFromStaffAssignments([assignment({
      id: 'assignment-1',
      staffId: 'staff-1',
      academicYearId: 'year-1',
      responsibility: 'Homeroom',
      classGroupId: 'cg-1',
    })])

    expect(grants).toEqual(assignmentScopedPermissions.map(permission => ({
      permission,
      scopeType: 'class_group',
      scopeEntityIds: ['cg-1'],
    })))
  })

  test('emits course assignment scoped grants from class subject target', () => {
    const grants = scopeGrantsFromStaffAssignments([assignment({
      id: 'assignment-1',
      staffId: 'staff-1',
      academicYearId: 'year-1',
      responsibility: 'Subject teacher',
      classSubjectId: 'cs-1',
    })])

    expect(grants).toEqual(assignmentScopedPermissions.map(permission => ({
      permission,
      scopeType: 'course_assignment',
      scopeEntityIds: ['cs-1'],
    })))
  })

  test('emits session scoped grants from lesson and activity session targets', () => {
    const lessonGrants = scopeGrantsFromStaffAssignments([assignment({
      id: 'assignment-lesson',
      staffId: 'staff-1',
      academicYearId: 'year-1',
      responsibility: 'Lesson lead',
      lessonSessionId: 'ls-1',
    })])
    const activityGrants = scopeGrantsFromStaffAssignments([assignment({
      id: 'assignment-activity',
      staffId: 'staff-1',
      academicYearId: 'year-1',
      responsibility: 'Activity lead',
      activitySessionId: 'as-1',
    })])

    expect(lessonGrants).toEqual(assignmentScopedPermissions.map(permission => ({
      permission,
      scopeType: 'session',
      scopeEntityIds: ['ls-1'],
    })))
    expect(activityGrants).toEqual(assignmentScopedPermissions.map(permission => ({
      permission,
      scopeType: 'session',
      scopeEntityIds: ['as-1'],
    })))
  })
})
