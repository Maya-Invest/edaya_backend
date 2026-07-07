import type { BusinessRuleViolationError } from '../../../../src/domain/shared/business-rule-error'
import { describe, expect, mock, test } from 'bun:test'
import {
  TeacherAssignment,
  TeacherAssignmentKind,
  TeacherAssignmentStatus,
  validateTeacherAssignmentSave,
} from '../../../../src/domain'
import { DomainValidationError } from '../../../../src/domain/shared/utils'

const subjectAssignment = new TeacherAssignment({
  id: 'ta-1',
  teacherId: 'teacher-1',
  academicYearId: 'year-1',
  kind: TeacherAssignmentKind.Subject,
  classSubjectId: 'cs-1',
})

const homeroomAssignment = new TeacherAssignment({
  id: 'ta-2',
  teacherId: 'teacher-1',
  academicYearId: 'year-1',
  kind: TeacherAssignmentKind.Homeroom,
  classGroupId: 'class-1',
})

function repositories(overrides: Record<string, unknown> = {}) {
  return {
    teachers: {
      findById: mock(async () => ({ id: 'teacher-1', schoolId: 'school-1' })),
    },
    academicYears: {
      findById: mock(async () => ({ id: 'year-1', schoolId: 'school-1' })),
    },
    classSubjects: {
      findById: mock(async () => ({ id: 'cs-1', classGroupId: 'class-1' })),
    },
    classGroups: {
      findById: mock(async () => ({ id: 'class-1', schoolId: 'school-1', academicYearId: 'year-1' })),
    },
    ...overrides,
  } as never
}

describe('TeacherAssignment schema refinements', () => {
  test('requires classSubjectId when kind is subject', () => {
    expect(() => new TeacherAssignment({
      id: 'ta-1',
      teacherId: 'teacher-1',
      academicYearId: 'year-1',
      kind: TeacherAssignmentKind.Subject,
    })).toThrow(DomainValidationError)
  })

  test('requires classGroupId when kind is homeroom', () => {
    expect(() => new TeacherAssignment({
      id: 'ta-1',
      teacherId: 'teacher-1',
      academicYearId: 'year-1',
      kind: TeacherAssignmentKind.Homeroom,
    })).toThrow(DomainValidationError)
  })

  test('requires endsAt when status is ended', () => {
    expect(() => new TeacherAssignment({
      id: 'ta-1',
      teacherId: 'teacher-1',
      academicYearId: 'year-1',
      kind: TeacherAssignmentKind.Homeroom,
      classGroupId: 'class-1',
      status: TeacherAssignmentStatus.Ended,
    })).toThrow(DomainValidationError)
  })
})

describe('validateTeacherAssignmentSave', () => {
  test('accepts subject assignments when references belong to the teacher school and year', async () => {
    await validateTeacherAssignmentSave(subjectAssignment, undefined, repositories())
  })

  test('accepts homeroom assignments when the class group belongs to the academic year', async () => {
    await validateTeacherAssignmentSave(homeroomAssignment, undefined, repositories())
  })

  test('rejects assignments when the teacher does not exist', async () => {
    await expect(validateTeacherAssignmentSave(subjectAssignment, undefined, repositories({
      teachers: { findById: mock(async () => undefined) },
    }))).rejects.toMatchObject({
      code: 'TEACHER_NOT_FOUND',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('rejects assignments when the academic year is outside the teacher school', async () => {
    await expect(validateTeacherAssignmentSave(subjectAssignment, undefined, repositories({
      academicYears: {
        findById: mock(async () => ({ id: 'year-1', schoolId: 'other-school' })),
      },
    }))).rejects.toMatchObject({
      code: 'ACADEMIC_YEAR_NOT_FOUND',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('rejects subject assignments when the class subject is missing', async () => {
    await expect(validateTeacherAssignmentSave(subjectAssignment, undefined, repositories({
      classSubjects: { findById: mock(async () => undefined) },
    }))).rejects.toMatchObject({
      code: 'CLASS_SUBJECT_NOT_FOUND',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('rejects subject assignments when the class group year does not match', async () => {
    await expect(validateTeacherAssignmentSave(subjectAssignment, undefined, repositories({
      classGroups: {
        findById: mock(async () => ({ id: 'class-1', schoolId: 'school-1', academicYearId: 'year-2' })),
      },
    }))).rejects.toMatchObject({
      code: 'CLASS_GROUP_NOT_FOUND',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('rejects homeroom assignments when the class group is outside the school or year', async () => {
    await expect(validateTeacherAssignmentSave(homeroomAssignment, undefined, repositories({
      classGroups: {
        findById: mock(async () => ({ id: 'class-1', schoolId: 'other-school', academicYearId: 'year-1' })),
      },
    }))).rejects.toMatchObject({
      code: 'CLASS_GROUP_NOT_FOUND',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('rejects homeroom updates when the persisted assignment id does not match', async () => {
    const existing = new TeacherAssignment({
      id: 'ta-existing',
      teacherId: 'teacher-1',
      academicYearId: 'year-1',
      kind: TeacherAssignmentKind.Homeroom,
      classGroupId: 'class-1',
    })

    await expect(validateTeacherAssignmentSave(homeroomAssignment, existing, repositories())).rejects.toMatchObject({
      code: 'TEACHER_ASSIGNMENT_CONFLICT',
    } satisfies Partial<BusinessRuleViolationError>)
  })
})
