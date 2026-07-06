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
import { createRepositoryAuthorizationPolicy } from '../../../src/capabilities/authorization/policy/repository-policy'
import { ReportCardDefinitionSectionKind } from '../../../src/domain/assessments/report-card-definition-section'
import { ReportCardResult } from '../../../src/domain/assessments/report-card-result'
import { ReportCardResultSection } from '../../../src/domain/assessments/report-card-result-section'
import { AttendanceRecord, AttendanceStatus } from '../../../src/domain/scheduling/attendance-record'
import { AttendanceSummary } from '../../../src/domain/value-objects/attendance-summary'

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

  test('checkAssessmentAccess allows assigned subject teachers only', async () => {
    const repositories = {
      assessments: {
        findByIds: async () => [{
          id: 'assessment-1',
          classGroupId: 'cg-7a',
          classSubjectId: 'cs-math',
        }],
      },
      classSubjects: {
        findByIds: async () => [{ id: 'cs-math', classGroupId: 'cg-7a' }],
      },
    }
    const policy = createRepositoryAuthorizationPolicy({ repositories: repositories as never })

    await expect(policy.checkAssessmentAccess(teacherActor(), ['assessment-1'])).resolves.toBeUndefined()
    await expect(policy.checkAssessmentAccess(
      teacherActor({ classSubjectIds: ['cs-french'] }),
      ['assessment-1'],
    )).rejects.toThrow(AuthorizationError)
  })

  test('checkReportCardResultAccess scopes teacher reads to homeroom class or assigned subjects', async () => {
    const result = new ReportCardResult({
      id: 'result-1',
      reportCardDefinitionId: 'def-1',
      studentId: 'student-1',
      classGroupId: 'cg-7a',
      periodId: 'period-1',
      sectionResults: [
        new ReportCardResultSection({
          sectionId: 'subject-math',
          sectionKind: ReportCardDefinitionSectionKind.Subject,
          name: 'Mathematics',
          average: 15,
          weight: 1,
          classSubjectId: 'cs-math',
        }),
      ],
      attendanceSummary: new AttendanceSummary({ presentCount: 10, absenceCount: 0, lateCount: 0 }),
      assessmentResultCount: 1,
      generatedAt: new Date('2026-09-01T00:00:00Z'),
    })
    const repositories = {
      results: {
        findByIds: async () => [result],
      },
    }
    const policy = createRepositoryAuthorizationPolicy({ repositories: repositories as never })

    await expect(policy.checkReportCardResultAccess(
      teacherActor({ classSubjectIds: ['cs-math'], classGroupIds: [] }),
      ['result-1'],
    )).resolves.toBeUndefined()

    await expect(policy.checkReportCardResultAccess(
      teacherActor({ classSubjectIds: ['cs-history'], classGroupIds: [] }),
      ['result-1'],
    )).rejects.toThrow(AuthorizationError)

    await expect(policy.checkReportCardResultAccess(
      teacherActor({ classGroupIds: ['cg-7a'], classSubjectIds: [] }),
      ['result-1'],
    )).resolves.toBeUndefined()
  })

  test('checkAttendanceRecordAccess splits session and daily attendance capabilities', async () => {
    const repositories = {
      students: { findByIds: async () => [{ id: 'student-1', schoolId: 'school-1' }] },
      enrollments: {
        list: async () => [{ studentId: 'student-1', classGroupId: 'cg-7a', status: 'active' }],
      },
      classSubjects: {
        findByIds: async () => [{ id: 'cs-math', classGroupId: 'cg-7a' }],
      },
      lessonSessions: {
        findById: async (id: string) => id === 'session-1'
          ? { id, classGroupId: 'cg-7a', classSubjectId: 'cs-math' }
          : undefined,
        findByIds: async () => [],
      },
      attendances: {
        findById: async (id: string) => id === 'attendance-1'
          ? { id, classGroupId: 'cg-7a' }
          : undefined,
        findByIds: async () => [],
      },
      activitySessions: { findByIds: async () => [] },
    }
    const policy = createRepositoryAuthorizationPolicy({ repositories: repositories as never })
    const actor = teacherActor()

    const sessionRecord = new AttendanceRecord({
      id: 'ar-1',
      studentId: 'student-1',
      lessonSessionId: 'session-1',
      date: new Date('2026-09-01'),
      status: AttendanceStatus.Present,
    })
    await expect(policy.checkAttendanceRecordAccess(actor, [sessionRecord])).resolves.toBeUndefined()

    const dailyRecord = new AttendanceRecord({
      id: 'ar-2',
      studentId: 'student-1',
      attendanceId: 'attendance-1',
      date: new Date('2026-09-01'),
      status: AttendanceStatus.Present,
    })
    await expect(policy.checkAttendanceRecordAccess(actor, [dailyRecord])).resolves.toBeUndefined()

    const wrongSubjectRecord = new AttendanceRecord({
      id: 'ar-3',
      studentId: 'student-1',
      lessonSessionId: 'session-2',
      date: new Date('2026-09-01'),
      status: AttendanceStatus.Present,
    })
    repositories.lessonSessions.findById = async () => ({
      id: 'session-2',
      classGroupId: 'cg-7a',
      classSubjectId: 'cs-french',
    })
    await expect(policy.checkAttendanceRecordAccess(actor, [wrongSubjectRecord])).rejects.toThrow(AuthorizationError)
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
