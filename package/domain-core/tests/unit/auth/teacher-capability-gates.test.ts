import { describe, expect, test } from 'bun:test'
import {
  ActorAssuranceLevel,
  assertHomeroomCapability,
  assertTeachingCapability,
  AuthorizationError,
  createTeacherActorMetadata,
  EMPTY_TEACHER_SCOPE,
  HomeroomCapability,
  TeachingCapability,
} from '../../../src/capabilities/authorization'

function teacherActor(scope: {
  classSubjectIds?: readonly string[]
  classGroupIds?: readonly string[]
} = {}) {
  return createTeacherActorMetadata({
    subjectId: 'user-teacher',
    teacherId: 'teacher-1',
    schoolId: 'school-1',
    teacherScope: {
      teaching: { classSubjectIds: scope.classSubjectIds ?? ['cs-math'] },
      homeroom: { classGroupIds: scope.classGroupIds ?? ['cg-7a'] },
    },
    requestId: 'test',
    authenticatedAt: new Date('2026-09-01T00:00:00Z'),
    assuranceLevel: ActorAssuranceLevel.Standard,
  })
}

describe('teacher capability gates', () => {
  test('assertTeachingCapability rejects unassigned class subjects', () => {
    expect(() => assertTeachingCapability(
      teacherActor({ classSubjectIds: ['cs-math'] }),
      TeachingCapability.InputGrade,
      { classSubjectId: 'cs-french' },
    )).toThrow(AuthorizationError)
  })

  test('assertHomeroomCapability rejects unassigned class groups', () => {
    expect(() => assertHomeroomCapability(
      teacherActor({ classGroupIds: ['cg-7a'] }),
      HomeroomCapability.RecordDailyAttendance,
      { classGroupId: 'cg-8b' },
    )).toThrow(AuthorizationError)
  })

  test('empty teacher scope still resolves but write gates fail', () => {
    const actor = createTeacherActorMetadata({
      subjectId: 'user-teacher',
      teacherId: 'teacher-1',
      schoolId: 'school-1',
      teacherScope: EMPTY_TEACHER_SCOPE,
      requestId: 'test',
      authenticatedAt: new Date('2026-09-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Standard,
    })

    expect(() => assertTeachingCapability(
      actor,
      TeachingCapability.InputGrade,
      { classSubjectId: 'cs-math' },
    )).toThrow(AuthorizationError)
  })
})
