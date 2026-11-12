import type { PGlite } from '@electric-sql/pglite'
import type { PostgresSchoolRepositories } from '../src/postgres-school-repositories'
import { AccountInvitation, AccountInvitationContactChannel, AccountInvitationKind, AccountInvitationStatus, Assessment, AssessmentKind, AssessmentResult, ClassSubject, ClassSubjectMatter, ClassSubjectMatterStatus, DayOfWeek, GradeLevel, LessonSession, PeriodDefinition, ReportCardResult, School, Subject, SubjectCategoryEntity, TeacherUnavailability, TeacherUnavailabilityRecurrence, withShortName } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { usePooledDatabases } from './support/pooled-database'

const { createRepositoryDatabase, releaseDatabase } = usePooledDatabases()

describe('PostgresSchoolRepositories with PGlite', () => {
  let pglite: PGlite
  let repos: PostgresSchoolRepositories

  beforeEach(async () => {
    const fixture = await createRepositoryDatabase()
    pglite = fixture.db
    repos = fixture.repositories
  })

  afterEach(async () => {
    await releaseDatabase(pglite)
  })

  test('round-trips optional report thresholds without losing three-decimal precision', async () => {
    const level = new GradeLevel(withShortName({ id: 'level', schoolId: 'school', name: 'Level', shortName: 'L', order: 1, reportSettings: [{ academicYearId: 'year', revision: 1, passThreshold: 10.125 }] }))
    await repos.gradeLevels.save(level)
    expect((await repos.gradeLevels.findById('level'))?.reportSettingsFor('year').passThreshold).toBe(10.125)
    const result = new ReportCardResult({ id: 'threshold-result', gradeLevelId: 'level', academicYearId: 'year', reportConfigurationRevision: 1, studentId: 'student', classGroupId: 'class', periodId: 'period', assessmentResultCount: 0, sectionResults: [], attendanceSummary: { presentCount: 0, absenceCount: 0, excusedAbsenceCount: 0, lateCount: 0 }, overallAverage: 10.12, passThreshold: 10.125 })
    await repos.results.save(result)
    const captured = (await repos.results.findById(result.id))!
    expect(captured.passThreshold).toBe(10.125)
    expect(captured.isPassing).toBe(false)
  })

  test('round-trips a fractional assessment score', async () => {
    await repos.assessments.save(new Assessment({
      id: 'assessment-fraction',
      classGroupId: 'class-a',
      classSubjectId: 'subject-a',
      periodId: 'period-a',
      title: 'Quiz',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      coefficient: 1.5,
      startsAt: new Date('2026-02-01T09:00:00.000Z'),
      endsAt: new Date('2026-02-01T10:00:00.000Z'),
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    }))
    await repos.assessmentResults.save(new AssessmentResult({
      id: 'result-fraction',
      studentId: 'student-a',
      assessmentId: 'assessment-fraction',
      score: 12.5,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    }))

    const assessment = await repos.assessments.findById('assessment-fraction')
    const result = await repos.assessmentResults.findById('result-fraction')
    expect(assessment?.maxScore).toBe(20)
    expect(assessment?.coefficient).toBe(1.5)
    expect(result?.score).toBe(12.5)
  })

  test('persists and reads schools through PostgresStore', async () => {
    const school = new School(withShortName({
      id: 'school-1',
      name: 'Edaya Academy',
      timeZone: 'Africa/Douala',
      timetableEnforceWorkloadFulfillment: false,
      timetableExcludeBreakSlots: false,
      timetableMinDayGapSameSubject: 4,
      timetablePreferredPeriodDefinitionIds: ['period-1'],
      timetableAllowUnassignedTeacherPlacements: true,
      timetableUseHomeroomTeacherFallback: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }))

    await repos.schoolsStore.save(school)

    await expect(repos.schoolsStore.findById('school-1')).resolves.toMatchObject({
      id: 'school-1',
      name: 'Edaya Academy',
      timeZone: 'Africa/Douala',
      timetableEnforceWorkloadFulfillment: false,
      timetableExcludeBreakSlots: false,
      timetableMinDayGapSameSubject: 4,
      timetablePreferredPeriodDefinitionIds: ['period-1'],
      timetableAllowUnassignedTeacherPlacements: true,
      timetableUseHomeroomTeacherFallback: true,
    })
  })

  test('lists and counts schools with repository filters', async () => {
    await repos.schoolsStore.batchSave([
      new School(withShortName({
        id: 'school-a',
        name: 'North Campus',
        timeZone: 'Africa/Douala',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      })),
      new School(withShortName({
        id: 'school-b',
        name: 'South Campus',
        timeZone: 'Africa/Douala',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      })),
    ])

    await expect(repos.schoolsStore.list({ name: 'North Campus' })).resolves.toHaveLength(1)
    await expect(repos.schoolsStore.count({})).resolves.toBe(2)
  })

  test('deletes persisted schools by id', async () => {
    await repos.schoolsStore.save(new School(withShortName({
      id: 'school-delete',
      name: 'Temporary School',
      timeZone: 'Africa/Douala',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })))

    await repos.schoolsStore.delete('school-delete')
    await expect(repos.schoolsStore.findById('school-delete')).resolves.toBeUndefined()
  })

  test('round trips timetable preparation fields', async () => {
    await repos.periodDefinitions.save(new PeriodDefinition(withShortName({
      id: 'period-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      name: 'Monday morning',
      dayOfWeek: DayOfWeek.Monday,
      order: 1,
      startTime: '08:00',
      endTime: '09:00',
      isTeachingSlot: false,
    })))
    await repos.subjectCategories.save(new SubjectCategoryEntity(withShortName({ id: 'category-1', schoolId: 'school-1', name: 'Scientific' })))
    await repos.subjects.save(new Subject(withShortName({
      categoryId: 'category-1',
      id: 'subject-1',
      schoolId: 'school-1',
      name: 'Math',
      gradeLevelId: 'grade-1',
      academicYearId: 'year-1',
      periodsPerWeek: 5,
    })))
    await repos.classSubjects.save(new ClassSubject({
      id: 'class-subject-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
      periodsPerWeek: 5,
    }))
    await repos.lessonSessions.save(new LessonSession({
      id: 'lesson-1',
      schoolId: 'school-1',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      timetableGenerated: true,
      timetableTeacherIds: ['teacher-1'],
      startsAt: new Date('2026-09-07T08:00:00.000Z'),
      endsAt: new Date('2026-09-07T09:00:00.000Z'),
      displayLabel: 'Mathematics',
    }))

    expect(await repos.periodDefinitions.findById('period-1')).toMatchObject({
      dayOfWeek: DayOfWeek.Monday,
      isTeachingSlot: false,
    })
    expect((await repos.subjects.findById('subject-1'))?.periodsPerWeek).toBe(5)
    expect((await repos.classSubjects.findById('class-subject-1'))?.periodsPerWeek).toBe(5)
    expect(await repos.lessonSessions.findById('lesson-1')).toMatchObject({
      scheduleId: undefined,
      timetableGenerated: true,
      timetableTeacherIds: ['teacher-1'],
    })
  })

  test('round trips weekly teacher unavailability', async () => {
    await repos.teacherUnavailabilities.save(new TeacherUnavailability({
      id: 'unavailability-1',
      teacherId: 'teacher-1',
      academicYearId: 'year-1',
      recurrence: TeacherUnavailabilityRecurrence.Weekly,
      dayOfWeek: DayOfWeek.Tuesday,
      startTime: '08:30',
      endTime: '11:00',
      effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      effectiveUntil: new Date('2026-12-31T00:00:00.000Z'),
      reason: 'Contract teaching hours',
    }))

    expect(await repos.teacherUnavailabilities.findById('unavailability-1')).toMatchObject({
      teacherId: 'teacher-1',
      recurrence: TeacherUnavailabilityRecurrence.Weekly,
      dayOfWeek: DayOfWeek.Tuesday,
      startTime: '08:30',
      reason: 'Contract teaching hours',
    })
  })

  test('batchSave inserts and upserts class subject matters across chunk boundaries', async () => {
    const batchSize = 501
    const initial = Array.from({ length: batchSize }, (_, index) => new ClassSubjectMatter({
      id: `csm-${index}`,
      classSubjectId: `class-subject-${index % 20}`,
      subjectMatterId: `matter-${index}`,
      status: ClassSubjectMatterStatus.NotStarted,
      completedPercentage: 0,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }))

    await expect(repos.classSubjectMatters.batchSave(initial)).resolves.toHaveLength(batchSize)
    await expect(repos.classSubjectMatters.count({})).resolves.toBe(batchSize)

    const updated = initial.map((entity, index) => new ClassSubjectMatter({
      id: entity.id,
      classSubjectId: entity.classSubjectId,
      subjectMatterId: entity.subjectMatterId,
      status: ClassSubjectMatterStatus.InProgress,
      completedPercentage: 25,
      notes: `progress-${index}`,
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    }))

    await repos.classSubjectMatters.batchSave(updated)
    await expect(repos.classSubjectMatters.count({})).resolves.toBe(batchSize)

    const first = await repos.classSubjectMatters.findById('csm-0')
    const last = await repos.classSubjectMatters.findById(`csm-${batchSize - 1}`)
    expect(first).toMatchObject({
      status: ClassSubjectMatterStatus.InProgress,
      completedPercentage: 25,
      notes: 'progress-0',
    })
    expect(last).toMatchObject({
      status: ClassSubjectMatterStatus.InProgress,
      completedPercentage: 25,
      notes: `progress-${batchSize - 1}`,
    })
  })

  test('finds pending invitations by contact and excludes expired or other kinds', async () => {
    const pending = new AccountInvitation({
      id: 'inv-pending',
      schoolId: 'school-1',
      kind: AccountInvitationKind.Guardian,
      targetId: 'guardian-1',
      contactChannel: AccountInvitationContactChannel.Email,
      contactValue: 'parent@school.edu',
      tokenHash: 'a'.repeat(64),
      status: AccountInvitationStatus.Pending,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      createdByStaffId: 'staff-1',
    })
    const expired = pending.copyWith({
      id: 'inv-expired',
      targetId: 'guardian-expired',
      tokenHash: 'b'.repeat(64),
      expiresAt: new Date('2000-01-01T00:00:00.000Z'),
    })
    const staff = pending.copyWith({
      id: 'inv-staff',
      kind: AccountInvitationKind.Staff,
      targetId: 'staff-1',
      tokenHash: 'c'.repeat(64),
    })
    await repos.accountInvitations.save(pending)
    await repos.accountInvitations.save(expired)
    await repos.accountInvitations.save(staff)

    const found = await repos.accountInvitations.findPendingByContact({
      contactChannel: AccountInvitationContactChannel.Email,
      contactValue: 'parent@school.edu',
      kind: AccountInvitationKind.Guardian,
    })
    expect(found.map(invitation => invitation.id)).toEqual(['inv-pending'])
  })
})
