import { AcademicDiscipline, AcademicPeriod, AcademicYear, Assessment, AssessmentKind, AssessmentResult, AttendanceRecord, AttendanceStatus, ClassGroup, GradeLevel, LessonSession, OccurrenceStatus, ReportCardDefinitionSectionKind, ReportCardResult, ReportCardResultSection, ReportCardResultStatus, Student, StudentSubjectEnrollment } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, it, setSystemTime } from 'bun:test'
import { createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

async function context(optional = false) {
  const fixture = await createTestApp(createTestStaffActor('sch1', 'user1'), { owner: true })
  const repositories = fixture.schoolRepositories
  await repositories.academicDisciplines.save(new AcademicDiscipline({ id: 'discipline', schoolId: 'sch1', code: 'ART', name: 'Art' }))
  await repositories.academicYears.save(new AcademicYear({ id: 'year', schoolId: 'sch1', name: 'Year', startDate: new Date('2026-01-01'), endDate: new Date('2028-12-31'), status: 'published' }))
  await repositories.gradeLevels.save(new GradeLevel({ id: 'grade', schoolId: 'sch1', name: 'Grade', label: '1', order: 1 }))
  await repositories.classGroups.save(new ClassGroup({ id: 'class', schoolId: 'sch1', academicYearId: 'year', gradeLevelId: 'grade', name: 'Class' }))
  await repositories.students.save(new Student({ id: 'student', schoolId: 'sch1', firstName: 'Ada', lastName: 'Lovelace' }))
  await fixture.app.academicsWorkflow.configureSubject({ id: 'art', schoolId: 'sch1', disciplineId: 'discipline', gradeLevelId: 'grade', academicYearId: 'year', name: 'Art', isOptional: optional })
  const offering = (await repositories.classSubjects.findOne({ subjectId: 'art' }))!
  if (optional)
    await fixture.app.academicsWorkflow.setClassSubjectOffered({ classSubjectId: offering.id, expectedParticipationRevision: offering.participationRevision, isOffered: true })
  await fixture.app.studentWorkflow.enrollStudent({ id: 'placement', studentId: 'student', classGroupId: 'class', enrolledAt: new Date('2026-09-01') })
  return { ...fixture, repositories, offering }
}

async function revision(ctx: Awaited<ReturnType<typeof context>>) {
  return (await ctx.repositories.classSubjects.findById(ctx.offering.id))!.participationRevision
}

beforeEach(() => setSystemTime(new Date('2026-10-24T12:00:00Z')))
afterEach(() => setSystemTime())
type Context = Awaited<ReturnType<typeof context>>
type Selection = { scope: 'annual' } | { scope: 'none' } | { scope: 'periods', periodIds: string[] }
async function request(ctx: Context, selection: Selection, requestId = crypto.randomUUID()) {
  return { requestId, expectedRevisions: { [ctx.offering.id]: await revision(ctx) }, operations: [{ studentClassEnrollmentId: 'placement', classSubjectId: ctx.offering.id, selection }] }
}
async function select(ctx: Context, selection: Selection = { scope: 'annual' }) {
  return ctx.app.studentWorkflow.manageStudentSubjectEnrollments(await request(ctx, selection))
}
async function current(ctx: Context) {
  return (await ctx.repositories.subjectEnrollments.list({ studentClassEnrollmentId: 'placement' })).find(row => !row.deletedAt)!
}
async function period(ctx: Context, id = 'term', start = '2026-09-01', end = '2026-12-31') {
  const row = new AcademicPeriod({ id, schoolId: 'sch1', academicYearId: 'year', name: id, startDate: new Date(start), endDate: new Date(end) })
  await ctx.repositories.academicPeriods.save(row)
  return row
}
async function assessment(ctx: Context, submitted = false) {
  await period(ctx)
  const row = new Assessment({ id: 'assessment', classGroupId: 'class', classSubjectId: ctx.offering.id, periodId: 'term', title: 'Art', kind: AssessmentKind.Quiz, maxScore: 20, startsAt: new Date('2026-11-01T09:00:00Z'), endsAt: new Date('2026-11-01T10:00:00Z'), marksStatus: submitted ? 'submitted' : 'draft', marksReview: { rosterStudentIds: submitted ? ['student'] : [] } })
  await ctx.repositories.assessments.save(row)
  return row
}
async function lesson(ctx: Context) {
  const row = new LessonSession({ id: 'lesson', schoolId: 'sch1', classGroupId: 'class', classSubjectId: ctx.offering.id, displayLabel: 'Art', startsAt: new Date('2026-11-01T09:00:00Z'), endsAt: new Date('2026-11-01T10:00:00Z') })
  await ctx.repositories.lessonSessions.save(row)
  return row
}

describe('current subject selections', () => {
  it('keeps compulsory admission automatic and rejects individual withdrawal', async () => {
    const ctx = await context()
    expect((await current(ctx)).source).toBe('automatic')
    expect((await current(ctx)).enrolledAt.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    await expect(select(ctx, { scope: 'none' })).rejects.toMatchObject({ code: 'COMPULSORY_SUBJECT_MANAGED' })
  })

  it('hard deletes unused enrollment, replays deletion, and re-enrolls with a new identity', async () => {
    const ctx = await context(true)
    const enroll = await request(ctx, { scope: 'annual' })
    const first = await ctx.app.studentWorkflow.manageStudentSubjectEnrollments(enroll)
    expect(await ctx.app.studentWorkflow.manageStudentSubjectEnrollments(enroll)).toEqual(first)
    const old = await current(ctx)
    expect(old.enrolledAt.toISOString()).toBe('2026-10-24T12:00:00.000Z')
    const withdraw = await request(ctx, { scope: 'none' })
    const result = await ctx.app.studentWorkflow.manageStudentSubjectEnrollments(withdraw)
    expect(await ctx.repositories.subjectEnrollments.findById(old.id)).toBeUndefined()
    expect(await ctx.app.studentWorkflow.manageStudentSubjectEnrollments(withdraw)).toEqual(result)
    setSystemTime(new Date('2026-10-25T12:00:00Z'))
    await select(ctx)
    expect((await current(ctx)).id).not.toBe(old.id)
    expect((await current(ctx)).enrolledAt.toISOString()).toBe('2026-10-25T12:00:00.000Z')
  })

  it('preserves unchanged choices and starts current/future periods at the correct instants', async () => {
    const ctx = await context(true)
    await period(ctx)
    await period(ctx, 'future', '2027-01-01', '2027-03-31')
    await period(ctx, 'overlap', '2026-10-01', '2027-02-01')
    await select(ctx, { scope: 'periods', periodIds: ['term', 'future', 'overlap'] })
    const first = await current(ctx)
    expect(first.effectiveAt(new Date('2026-10-24T11:59:59Z'))).toBe(false)
    expect(first.effectiveAt(new Date('2027-01-01T00:00:00Z'))).toBe(true)
    expect((await ctx.app.getClassSubjectRoster({ classSubjectId: ctx.offering.id, at: new Date('2027-01-01') })).count).toBe(1)
    const rev = await revision(ctx)
    await select(ctx, { scope: 'periods', periodIds: ['overlap', 'future', 'term'] })
    expect(await revision(ctx)).toBe(rev)
    setSystemTime(new Date('2026-10-25T12:00:00Z'))
    await select(ctx, { scope: 'periods', periodIds: ['future', 'term'] })
    const updated = await current(ctx)
    expect(updated.id).toBe(first.id)
    expect(updated.periods.find(row => row.periodId === 'term')!.activatedAt).toEqual(first.periods.find(row => row.periodId === 'term')!.activatedAt)
    expect(updated.effectiveAt(new Date('2027-04-01'))).toBe(false)
  })

  it('rejects ended/foreign periods, duplicate periods and forged interval dates', async () => {
    const ctx = await context(true)
    await period(ctx, 'ended', '2026-01-01', '2026-03-31')
    await expect(select(ctx, { scope: 'periods', periodIds: ['ended'] })).rejects.toMatchObject({ code: 'SUBJECT_ENROLLMENT_PERIOD_ENDED' })
    await expect(select(ctx, { scope: 'periods', periodIds: ['unknown'] })).rejects.toMatchObject({ code: 'SUBJECT_ENROLLMENT_PERIOD_INVALID' })
    await period(ctx)
    await expect(select(ctx, { scope: 'periods', periodIds: ['term', 'term'] })).rejects.toMatchObject({ code: 'SUBJECT_ENROLLMENT_PERIOD_INVALID' })
    const input = await request(ctx, { scope: 'annual' })
    await expect(ctx.app.studentWorkflow.manageStudentSubjectEnrollments({ ...input, operations: [{ ...input.operations[0]!, enrolledAt: new Date('2026-01-01') }] } as never)).rejects.toThrow()
  })

  it('follows calendar edits but does not revive a withdrawn choice', async () => {
    const ctx = await context(true)
    const term = await period(ctx)
    await select(ctx, { scope: 'periods', periodIds: ['term'] })
    const rev = await revision(ctx)
    await ctx.app.baseService.entities.academicPeriods.save(new AcademicPeriod({ ...term.data, endDate: new Date('2027-01-31') }))
    expect((await current(ctx)).effectiveAt(new Date('2027-01-30'))).toBe(true)
    expect(await revision(ctx)).toBeGreaterThan(rev)
    await assessment(ctx)
    await ctx.repositories.assessmentResults.save(new AssessmentResult({ id: 'mark', assessmentId: 'assessment', studentId: 'student', score: 12 }))
    await select(ctx, { scope: 'none' })
    await ctx.app.baseService.entities.academicPeriods.save(new AcademicPeriod({ ...term.data, endDate: new Date('2027-02-28') }))
    expect(await current(ctx)).toBeUndefined()
    await expect(ctx.app.baseService.entities.academicPeriods.delete('term')).rejects.toThrow()
  })
})

describe('conditional withdrawal', () => {
  it.each(['marks', 'lesson-attendance', 'assessment-attendance', 'draft', 'frozen'])('soft deletes for %s and keeps the saved work', async (kind) => {
    const ctx = await context(true)
    await select(ctx)
    const old = await current(ctx)
    await assessment(ctx, kind === 'frozen')
    await lesson(ctx)
    if (kind === 'marks')
      await ctx.repositories.assessmentResults.save(new AssessmentResult({ id: 'mark', assessmentId: 'assessment', studentId: 'student', score: 12 }))
    if (kind.endsWith('attendance'))
      await ctx.repositories.attendance.save(new AttendanceRecord({ id: 'attendance', studentId: 'student', ...(kind === 'lesson-attendance' ? { lessonSessionId: 'lesson' } : { assessmentId: 'assessment' }), date: new Date('2026-11-01'), status: AttendanceStatus.Present }))
    if (kind === 'draft')
      await ctx.repositories.teacherCorrections.saveState({ schoolId: 'sch1', workflow: 'attendance', targetId: 'lesson:lesson', version: 1, locked: false, payload: { entries: [{ studentId: 'student', status: 'present' }] }, history: [] })
    await select(ctx, { scope: 'none' })
    const deleted = await ctx.repositories.subjectEnrollments.findById(old.id)
    expect(deleted?.deletedAt).toEqual(new Date())
    expect(deleted?.data.deletedBy).toBeTruthy()
    expect(deleted?.effectiveAt(new Date('2026-11-01'))).toBe(false)
    expect((await ctx.app.getStudentSubjectEnrollments({ studentId: 'student' })).enrollments).toEqual([])
    expect(await ctx.app.baseService.entities.subjectEnrollments.findById(old.id)).toBeUndefined()
    if (kind === 'marks')
      expect(await ctx.repositories.assessmentResults.findById('mark')).toBeDefined()
    if (kind.endsWith('attendance'))
      expect(await ctx.repositories.attendance.findById('attendance')).toBeDefined()
    if (kind === 'draft') {
      const { entries } = (await ctx.repositories.teacherCorrections.state('sch1', 'attendance', 'lesson:lesson'))!.payload
      expect(entries).toHaveLength(1)
    }
    await select(ctx)
    expect((await current(ctx)).id).not.toBe(old.id)
    expect(await ctx.repositories.subjectEnrollments.count()).toBe(2)
  })

  it('preserves published snapshots even when they have no marks', async () => {
    const ctx = await context(true)
    await select(ctx)
    await period(ctx)
    const old = await current(ctx)
    const report = new ReportCardResult({ id: 'published', assessmentResultCount: 0, studentId: 'student', classGroupId: 'class', periodId: 'term', reportCardDefinitionId: 'definition', status: ReportCardResultStatus.Published, publishedAt: new Date(), sectionResults: [new ReportCardResultSection({ sectionId: 'art-section', classSubjectId: ctx.offering.id, name: 'Art', sectionKind: ReportCardDefinitionSectionKind.Subject, weight: 1, subResults: [] })], attendanceSummary: { presentCount: 0, absenceCount: 0, lateCount: 0 } })
    await ctx.repositories.results.save(report)
    await select(ctx, { scope: 'none' })
    expect((await ctx.repositories.subjectEnrollments.findById(old.id))?.deletedAt).toBeDefined()
    expect((await ctx.repositories.results.findById(report.id))?.data).toEqual(report.data)
  })

  it('does not count unrelated daily attendance as a dependency', async () => {
    const ctx = await context(true)
    await select(ctx)
    const old = await current(ctx)
    await ctx.repositories.attendance.save(new AttendanceRecord({ id: 'daily', attendanceId: 'daily-call', studentId: 'student', date: new Date('2026-10-24'), status: AttendanceStatus.Present }))
    await select(ctx, { scope: 'none' })
    expect(await ctx.repositories.subjectEnrollments.findById(old.id)).toBeUndefined()
    expect(await ctx.repositories.attendance.findById('daily')).toBeDefined()
  })

  it('preserves withdrawn attendance draft entries through later save and submission', async () => {
    const ctx = await context(true)
    await select(ctx)
    await lesson(ctx)
    await ctx.repositories.teacherCorrections.saveState({ schoolId: 'sch1', workflow: 'attendance', targetId: 'lesson:lesson', version: 1, locked: false, payload: { entries: [{ studentId: 'student', status: 'present' }] }, history: [] })
    await select(ctx, { scope: 'none' })
    const state = (await ctx.repositories.teacherCorrections.state('sch1', 'attendance', 'lesson:lesson'))!
    expect(state.version).toBeGreaterThan(1)
    const input = { requestId: 'stale-attendance', anchor: { kind: 'lesson' as const, lessonSessionId: 'lesson' }, expectedVersion: 1, entries: [] }
    await expect(ctx.app.teacherCorrectionsWorkflow.attendanceCall('save', input)).rejects.toMatchObject({ code: 'ATTENDANCE_VERSION_CONFLICT' })
    const draft = await ctx.app.teacherCorrectionsWorkflow.attendanceCall('save', { ...input, requestId: 'save-retained', expectedVersion: state.version })
    const { entries } = draft.payload
    expect(entries).toEqual([{ studentId: 'student', status: 'present' }])
    await ctx.app.teacherCorrectionsWorkflow.attendanceCall('submit', { ...input, requestId: 'submit-retained-attendance', expectedVersion: draft.version })
    expect((await ctx.repositories.attendance.findOne({ lessonSessionId: 'lesson', studentId: 'student' }))?.status).toBe(AttendanceStatus.Present)
  })

  it('allows retained draft mark edits and cleanup but rejects new marks after withdrawal', async () => {
    const ctx = await context(true)
    await select(ctx)
    const sheet = await assessment(ctx)
    await ctx.repositories.assessmentResults.save(new AssessmentResult({ id: 'mark', assessmentId: sheet.id, studentId: 'student', score: 12 }))
    const old = await current(ctx)
    await select(ctx, { scope: 'none' })
    await ctx.app.baseService.entities.assessmentResults.save(new AssessmentResult({ id: 'mark', assessmentId: sheet.id, studentId: 'student', score: 15 }))
    await ctx.repositories.assessments.save(new Assessment({ ...sheet.data, id: 'another-assessment' }))
    await expect(ctx.app.baseService.entities.assessmentResults.save(new AssessmentResult({ id: 'new-mark', assessmentId: 'another-assessment', studentId: 'student', score: 10 }))).rejects.toMatchObject({ code: 'ACTIVE_ENROLLMENT_REQUIRED' })
    await ctx.app.baseService.entities.assessmentResults.delete('mark')
    expect(await ctx.repositories.assessmentResults.findById('mark')).toBeUndefined()
    expect((await ctx.repositories.subjectEnrollments.findById(old.id))?.deletedAt).toBeDefined()
    await expect(ctx.app.baseService.entities.assessmentResults.save(new AssessmentResult({ id: 'mark', assessmentId: sheet.id, studentId: 'student', score: 15 }))).rejects.toMatchObject({ code: 'ACTIVE_ENROLLMENT_REQUIRED' })
  })

  it('checks dependencies outside removed periods and leaves saved marks after partial updates', async () => {
    const ctx = await context(true)
    await period(ctx)
    await period(ctx, 'future', '2027-01-01', '2027-03-31')
    await select(ctx, { scope: 'periods', periodIds: ['term', 'future'] })
    await assessment(ctx)
    await ctx.repositories.assessmentResults.save(new AssessmentResult({ id: 'mark', assessmentId: 'assessment', studentId: 'student', score: 12 }))
    const old = await current(ctx)
    await select(ctx, { scope: 'periods', periodIds: ['future'] })
    expect((await current(ctx)).id).toBe(old.id)
    expect((await current(ctx)).deletedAt).toBeUndefined()
    await select(ctx, { scope: 'none' })
    expect((await ctx.repositories.subjectEnrollments.findById(old.id))?.deletedAt).toBeDefined()
    expect(await ctx.repositories.assessmentResults.findById('mark')).toBeDefined()
  })

  it('keeps marked students in a submitted sheet after withdrawal', async () => {
    const ctx = await context(true)
    await select(ctx)
    await assessment(ctx)
    await ctx.repositories.assessmentResults.save(new AssessmentResult({ id: 'mark', assessmentId: 'assessment', studentId: 'student', score: 12 }))
    await select(ctx, { scope: 'none' })
    const sheet = (await ctx.repositories.assessments.findById('assessment'))!
    const result = await ctx.app.assessmentsWorkflow.submitAssessmentMarks({ requestId: 'submit-retained', assessmentId: sheet.id, expectedRevision: sheet.marksRevision })
    expect(result.marksReview.rosterStudentIds).toEqual(['student'])
    expect((await ctx.repositories.assessmentResults.findById('mark'))!.score).toBe(12)
  })

  it('keeps retained marks in report subject applicability', async () => {
    const ctx = await context(true)
    await select(ctx)
    await assessment(ctx, true)
    await ctx.repositories.assessmentResults.save(new AssessmentResult({ id: 'mark', assessmentId: 'assessment', studentId: 'student', score: 12 }))
    await select(ctx, { scope: 'none' })
    const { loadReportAssessmentContext } = await import('../../../src/capabilities/academics/report-assessment-context')
    const report = await loadReportAssessmentContext(ctx.repositories, 'sch1', 'student', ['term'])
    expect(report.classSubjects.map(row => row.id)).toEqual([ctx.offering.id])
    expect(report.results.map(row => row.result.id)).toEqual(['mark'])
    await ctx.repositories.assessmentResults.save(new AssessmentResult({ id: 'mark', assessmentId: 'assessment', studentId: 'student', designation: 'exempt' }))
    expect((await loadReportAssessmentContext(ctx.repositories, 'sch1', 'student', ['term'])).classSubjects).toEqual([])
  })
})

describe('lifecycle and concurrency', () => {
  it('preserves optional availability and converts selected periods to compulsory annual coverage', async () => {
    const ctx = await context(true)
    await period(ctx, 'future', '2027-01-01', '2027-03-31')
    await select(ctx, { scope: 'periods', periodIds: ['future'] })
    await ctx.app.academicsWorkflow.updateSubject({ subjectId: 'art', expectedParticipationRevisions: { [ctx.offering.id]: await revision(ctx) }, isOptional: false })
    expect((await current(ctx)).scope).toBe('annual')
    expect((await current(ctx)).effectiveAt(new Date('2026-11-01'))).toBe(true)
    await ctx.app.academicsWorkflow.updateSubject({ subjectId: 'art', expectedParticipationRevisions: { [ctx.offering.id]: await revision(ctx) }, isOptional: true })
    expect((await ctx.repositories.classSubjects.findById(ctx.offering.id))!.isOffered).toBe(true)
    expect((await current(ctx)).scope).toBe('annual')
  })

  it('serializes concurrent additions and rejects stale revisions', async () => {
    const ctx = await context(true)
    const first = await request(ctx, { scope: 'annual' })
    const second = { ...first, requestId: 'other' }
    const results = await Promise.allSettled([ctx.app.studentWorkflow.manageStudentSubjectEnrollments(first), ctx.app.studentWorkflow.manageStudentSubjectEnrollments(second)])
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(row => row.status === 'rejected')).toHaveLength(1)
    expect(await ctx.repositories.subjectEnrollments.count()).toBe(1)
  })

  it('denies unmanaged writes and enforces one current selection at the database boundary', async () => {
    const ctx = await context(true)
    await select(ctx)
    const row = await current(ctx)
    await expect(ctx.app.baseService.entities.subjectEnrollments.delete(row.id)).rejects.toThrow()
    await expect(ctx.repositories.subjectEnrollments.save(new StudentSubjectEnrollment({ ...row.data, id: 'duplicate' }))).rejects.toThrow()
    const staff = ctx.forActor(createTestStaffActor('sch1', 'unprivileged'))
    await expect(staff.studentWorkflow.manageStudentSubjectEnrollments(await request(ctx, { scope: 'none' }))).rejects.toThrow()
  })

  it('retains offering disablement checks and cancels only unprotected future lessons', async () => {
    const ctx = await context(true)
    await select(ctx)
    const generated = await lesson(ctx)
    await ctx.repositories.lessonSessions.save(generated.copyWith({ timetableGenerated: true }))
    await assessment(ctx)
    const disable = async () => ctx.app.academicsWorkflow.setClassSubjectOffered({ classSubjectId: ctx.offering.id, expectedParticipationRevision: await revision(ctx), isOffered: false })
    await expect(disable()).rejects.toMatchObject({ code: 'SUBJECT_OFFERING_FUTURE_ASSESSMENTS' })
    expect(await current(ctx)).toBeDefined()
    await ctx.repositories.assessments.delete('assessment')
    await ctx.repositories.attendance.save(new AttendanceRecord({ id: 'attendance', lessonSessionId: 'lesson', studentId: 'student', date: new Date('2026-11-01'), status: AttendanceStatus.Present }))
    await expect(disable()).rejects.toMatchObject({ code: 'SUBJECT_OFFERING_PROTECTED_LESSONS' })
    await ctx.repositories.attendance.delete('attendance')
    await disable()
    expect((await ctx.repositories.lessonSessions.findById('lesson'))?.status).toBe(OccurrenceStatus.Cancelled)
    expect(await current(ctx)).toBeUndefined()
  })

  it('updates annual coverage when year boundaries change', async () => {
    const ctx = await context(true)
    await select(ctx)
    const year = (await ctx.repositories.academicYears.findById('year'))!
    await ctx.app.baseService.entities.academicYears.save(new AcademicYear({ ...year.data, endDate: new Date('2027-06-30') }))
    expect((await current(ctx)).endedAt).toEqual(new Date('2027-07-01'))
    expect((await current(ctx)).effectiveAt(new Date('2027-07-02'))).toBe(false)
  })

  it('carries future period choices to a compatible same-year class', async () => {
    const ctx = await context(true)
    await period(ctx, 'future', '2027-01-01', '2027-03-31')
    await select(ctx, { scope: 'periods', periodIds: ['future'] })
    await ctx.app.setupWorkflow.createClassGroup({ id: 'destination', schoolId: 'sch1', academicYearId: 'year', gradeLevelId: 'grade', name: 'Destination' })
    const target = (await ctx.repositories.classSubjects.findOne({ classGroupId: 'destination' }))!
    await ctx.app.academicsWorkflow.setClassSubjectOffered({ classSubjectId: target.id, expectedParticipationRevision: target.participationRevision, isOffered: true })
    await ctx.app.studentWorkflow.transferStudent({ enrollmentId: 'placement', nextEnrollmentId: 'destination-placement', nextClassGroupId: 'destination', effectiveAt: new Date() })
    const carried = (await ctx.repositories.subjectEnrollments.findOne({ studentClassEnrollmentId: 'destination-placement' }))!
    expect(carried.scope).toBe('periods')
    expect(carried.periods.map(row => row.periodId)).toEqual(['future'])
    expect(carried.effectiveAt(new Date('2027-02-01'))).toBe(true)
    expect(await current(ctx)).toBeUndefined()
  })

  it('uses school midnights across daylight-saving transitions', async () => {
    const { schoolDayStart } = await import('../../../src/capabilities/subject-enrollment/dates')
    expect(schoolDayStart(new Date('2026-03-08'), 'America/Toronto').toISOString()).toBe('2026-03-08T05:00:00.000Z')
    expect(schoolDayStart(new Date('2026-03-08'), 'America/Toronto', 1).toISOString()).toBe('2026-03-09T04:00:00.000Z')
  })
})
