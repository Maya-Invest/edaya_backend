import { ActorAssuranceLevel, AuthorizationError, createStaffActorMetadata } from '@edaya/authorization'
import { AcademicYear, ClassGroup, GradeLevel, Permission, StaffAssignment, StaffMember } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createTestApp } from '../support/create-test-app'
import { effectiveGrantsForRoles } from '../support/effective-grants'

async function seedStaffAssignmentFixture() {
  const context = createTestApp()
  const { repositories } = context

  const teacherActor = createStaffActorMetadata({
    subjectId: 'teacher-subject',
    staffMemberId: 'teacher-1',
    schoolId: 'school-1',
    effectiveGrants: {
      ...effectiveGrantsForRoles(['teacher']),
      permissions: new Set([
        ...effectiveGrantsForRoles(['teacher']).permissions,
        Permission.QUERY_WORKSPACE_READ,
      ]),
    },
    requestId: 'teacher-assignment-read',
    authenticatedAt: new Date('2026-09-01T00:00:00Z'),
    assuranceLevel: ActorAssuranceLevel.Standard,
  })
  const adminActor = createStaffActorMetadata({
    subjectId: 'admin-subject',
    staffMemberId: 'admin-1',
    schoolId: 'school-1',
    effectiveGrants: effectiveGrantsForRoles(['admin']),
    requestId: 'admin-assignment-read',
    authenticatedAt: new Date('2026-09-01T00:00:00Z'),
    assuranceLevel: ActorAssuranceLevel.Verified,
  })

  await repositories.schoolRepository.save({
    id: 'school-1',
    name: 'School',
    timeZone: 'UTC',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  } as never)
  await repositories.academicYearRepository.save(new AcademicYear({
    id: 'year-1',
    schoolId: 'school-1',
    name: '2025-2026',
    startDate: new Date('2025-09-01T00:00:00Z'),
    endDate: new Date('2026-07-01T00:00:00Z'),
    status: 'published',
  }))
  await repositories.gradeLevelRepository.save(new GradeLevel({
    id: 'grade-1',
    schoolId: 'school-1',
    name: '6',
    label: '6',
    order: 1,
  }))
  await repositories.classGroupRepository.save(new ClassGroup({
    id: 'class-1',
    schoolId: 'school-1',
    academicYearId: 'year-1',
    gradeLevelId: 'grade-1',
    name: '6A',
    capacity: 30,
  }))
  await repositories.staffMemberRepository.save(new StaffMember({
    id: 'teacher-1',
    schoolId: 'school-1',
    firstName: 'Marie',
    lastName: 'Teacher',
  }))
  await repositories.staffMemberRepository.save(new StaffMember({
    id: 'teacher-2',
    schoolId: 'school-1',
    firstName: 'Other',
    lastName: 'Teacher',
  }))
  await repositories.staffAssignmentRepository.save(new StaffAssignment({
    id: 'assignment-1',
    staffId: 'teacher-1',
    academicYearId: 'year-1',
    responsibility: 'Mathematics',
    classGroupId: 'class-1',
  }))
  await repositories.staffAssignmentRepository.save(new StaffAssignment({
    id: 'assignment-2',
    staffId: 'teacher-2',
    academicYearId: 'year-1',
    responsibility: 'French',
    classGroupId: 'class-1',
  }))

  return { context, teacherActor, adminActor }
}

describe('staff assignment read access', () => {
  test('allows teachers to list their own assignments', async () => {
    const { context, teacherActor } = await seedStaffAssignmentFixture()

    const assignments = await context.forActor(teacherActor)
      .baseService
      .entities
      .staffAssignments
      .list({ staffId: 'teacher-1', academicYearId: 'year-1' })

    expect(assignments.map(assignment => assignment.id)).toEqual(['assignment-1'])
  })

  test('denies teachers from reading another staff member assignments', async () => {
    const { context, teacherActor } = await seedStaffAssignmentFixture()

    await expect(
      context.forActor(teacherActor)
        .baseService.entities.staffAssignments.list({ staffId: 'teacher-2', academicYearId: 'year-1' }),
    ).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('allows structure admins to read any staff assignments', async () => {
    const { context, adminActor } = await seedStaffAssignmentFixture()

    const assignments = await context.forActor(adminActor)
      .baseService
      .entities
      .staffAssignments
      .list({ academicYearId: 'year-1' })

    expect(assignments).toHaveLength(2)
  })
})
