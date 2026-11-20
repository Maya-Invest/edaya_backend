import type { ActiveReportComment, TeacherCorrection } from '@edaya/core'
import { createTeacherActorMetadata } from '@edaya/authorization'
import { noOpFileStorage, noOpNotificationGateway, ReportCardResult, ReportCardResultSection, ReportCardResultSectionKind, ReportCardResultStatus, TeacherAssignment, TeacherAssignmentKind } from '@edaya/core'
import { SchoolService } from '@edaya/service'
import { expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/pglite'
import { PostgresAtomicExecution } from '../src/lib/transaction'
import { PostgresCommandJournal } from '../src/stores/command-journal-store'
import { seedAuthorizationRelationships } from './support/authorization-database'
import { usePooledDatabases } from './support/pooled-database'

const pool = usePooledDatabases()
test('gradebook comments follow the visible revision, current section assignments and correction authorship', async () => {
  const fixture = await pool.createAuthorizationDatabase()
  try {
    await seedAuthorizationRelationships(fixture.db)
    const repos = fixture.repositories
    // A saved mark keeps this pupil in a historical subject roster as well.
    await fixture.db.exec('update assessments set marks_status=\'submitted\' where id=\'assessment-math\'')
    const date = new Date('2026-05-01')
    const teacher = new SchoolService({
      actor: createTeacherActorMetadata({ schoolId: 'school-a', teacherId: 'teacher-a', subjectId: 'person-a', academicYearId: 'year-a', requestId: 'gradebook', authenticatedAt: date }),
      repositories: repos,
      atomicExecution: new PostgresAtomicExecution(drizzle(fixture.db)),
      commandJournal: new PostgresCommandJournal(),
      fileStorage: noOpFileStorage,
      notificationGateway: noOpNotificationGateway,
    })
    const section = (id: string, comment: string) => new ReportCardResultSection({
      sectionId: id,
      sectionKind: ReportCardResultSectionKind.Subject,
      classSubjectId: id,
      name: id,
      comment,
      weight: 1,
      subResults: [],
    })
    const sections = (text: string) => [new ReportCardResultSection({
      sectionId: 'module',
      sectionKind: ReportCardResultSectionKind.Module,
      name: 'Module',
      weight: 1,
      subResults: [section('math-a', text), section('french-a', 'French')],
    })]
    const report = new ReportCardResult({
      id: 'gradebook-report',
      gradeLevelId: 'level-a',
      academicYearId: 'year-a',
      reportConfigurationRevision: 0,
      studentId: 'student-a',
      classGroupId: 'class-a',
      periodId: 'period-a',
      status: ReportCardResultStatus.Published,
      publishedAt: date,
      assessmentResultCount: 0,
      attendanceSummary: { presentCount: 0, absenceCount: 0, excusedAbsenceCount: 0, lateCount: 0 },
      sectionResults: sections('Original'),
    })
    await repos.results.save(report)
    const input = { classSubjectId: 'math-a', periodId: 'period-a' }
    const comment = async () => (await teacher.getTeacherSubjectPeriodSummary(input)).students.find(row => row.studentId === report.studentId)!.comment
    const propose = (text: string, extras: Partial<ActiveReportComment['proposal']> = {}): ActiveReportComment['proposal'] => ({
      workflow: 'report_comments',
      targetId: report.id,
      sections: [{ sectionId: 'math-a', comment: text }],
      ...extras,
    })
    const save = async (id: string, proposal: ActiveReportComment['proposal'], status: TeacherCorrection['status'] = 'pending', author = 'person-a') => {
      await repos.teacherCorrections.save({ id, schoolId: 'school-a', classGroupId: 'class-a', studentIds: ['student-a'], workflow: 'report_comments', targetId: report.id, authorSubjectId: author, before: propose('Original'), proposal, baseVersion: 0, version: 0, reason: 'Review', status, createdAt: date, consequences: [], revisions: [] })
    }
    const mixed = propose('', { sections: [{ sectionId: 'math-a', comment: 'Two subjects' }, { sectionId: 'french-a', comment: 'Revised French' }] })
    await save('a-foreign', propose('Other teacher'), 'pending', 'other-person')
    expect((await comment())?.proposal).toBeNull()
    await save('a-foreign', propose('Other teacher'), 'withdrawn', 'other-person')
    await save('b-withdrawn', propose('Withdrawn'), 'withdrawn')
    await save('c-mixed', mixed)
    expect((await comment())?.proposal).toBeNull()
    await repos.teacherAssignments.save(new TeacherAssignment({ id: 'teach-french', teacherId: 'teacher-a', academicYearId: 'year-a', classSubjectId: 'french-a', kind: TeacherAssignmentKind.Subject }))
    expect((await comment())?.proposal?.text).toBe('Two subjects')
    await repos.teacherAssignments.delete('teach-french')
    expect((await comment())?.proposal).toBeNull()
    const unchangedFrench = propose('', { sections: [{ sectionId: 'math-a', comment: 'My revision' }, { sectionId: 'french-a', comment: 'French' }] })
    await save('c-mixed', unchangedFrench)
    expect((await comment())?.proposal).toBeNull()
    await save('c-mixed', mixed, 'withdrawn')
    const general = propose('Homeroom', { teacherComment: 'General revision' })
    await save('d-general', general)
    expect((await comment())?.proposal).toBeNull()
    await repos.teacherAssignments.save(new TeacherAssignment({ id: 'homeroom', teacherId: 'teacher-a', academicYearId: 'year-a', classGroupId: 'class-a', kind: TeacherAssignmentKind.Homeroom }))
    expect((await comment())?.proposal?.text).toBe('Homeroom')
    await repos.teacherAssignments.delete('homeroom')
    await save('d-general', general, 'withdrawn')
    await save('e-current', propose('My correction'), 'approved_pending_publication')
    expect(await comment()).toMatchObject({ text: 'Original', proposal: { text: 'My correction', status: 'approved_pending_publication' } })

    const visible = new ReportCardResult({ ...report.data, version: 4, sectionResults: sections('Ready for readers') })
    const preparing = new ReportCardResult({ ...report.data, version: 5, sectionResults: sections('Still rendering') })
    await repos.teacherCorrections.saveState({ schoolId: 'school-a', workflow: 'report_comments', targetId: report.id, version: 5, locked: true, payload: { visibleSnapshot: visible.data, snapshot: preparing.data }, history: [] })
    expect(await comment()).toMatchObject({ text: 'Ready for readers', version: 4, proposal: { text: 'My correction' } })
    await save('e-current', propose('My correction'), 'published')
    expect((await comment())?.proposal).toBeNull()
    await save('f-later', propose('Newer'), 'pending')
    expect((await comment())?.proposal?.text).toBe('Newer')
    await save('f-later', propose('Newer'), 'rejected')
    expect((await comment())?.proposal).toBeNull()
    await repos.teacherAssignments.delete('teaching')
    await expect(teacher.getTeacherSubjectPeriodSummary(input)).rejects.toThrow()
  }
  finally {
    await pool.releaseDatabase(fixture.db)
  }
})
