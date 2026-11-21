import type { SchoolService } from '@edaya/service'
import { ReportCardResult, ReportCardResultSection, ReportCardResultSectionKind, ReportCardResultStatus, School, Student, withShortName } from '@edaya/core'
import { expect, mock, test } from 'bun:test'
import { renderReportCardDocument } from '../../../src/capabilities/documents/render-report-card-document'

function publishedContext() {
  const school = new School(withShortName({ id: 'school', name: 'School', timeZone: 'UTC' }))
  const student = new Student({ id: 'pupil', schoolId: school.id, firstName: 'First', lastName: 'Last' })
  const result = new ReportCardResult({
    id: 'report',
    studentId: student.id,
    gradeLevelId: 'level',
    academicYearId: 'year',
    classGroupId: 'class',
    periodId: 'period',
    reportConfigurationRevision: 0,
    status: ReportCardResultStatus.Published,
    publishedAt: new Date('2026-09-01'),
    overallAverage: 12,
    assessmentResultCount: 1,
    sectionResults: [new ReportCardResultSection({ sectionId: 'math', sectionKind: ReportCardResultSectionKind.Subject, name: 'Math', classSubjectId: 'math', average: 12, weight: 1 })],
    attendanceSummary: { presentCount: 1, absenceCount: 0, excusedAbsenceCount: 0, lateCount: 0 },
  })
  return {
    result,
    school,
    student,
    period: { id: 'period', name: 'Term', isPublished: true },
    classGroup: { id: 'class', name: 'Class' },
    academicYear: { id: 'year', name: 'Year' },
    attachments: [],
    subjects: [],
    peerResults: [],
    teacherNameByClassSubjectId: new Map([['math', 'Named teacher']]),
    teachersByClassSubjectId: new Map(),
    homeroomTeachers: [],
  }
}

const changes = {
  average: (ctx: ReturnType<typeof publishedContext>) => { ctx.result = new ReportCardResult({ ...ctx.result.data, sectionResults: [...ctx.result.sectionResults], overallAverage: 13 }) },
  student: (ctx: ReturnType<typeof publishedContext>) => { ctx.student = new Student({ ...ctx.student.data, firstName: 'Changed' }) },
  assignment: (ctx: ReturnType<typeof publishedContext>) => { ctx.teacherNameByClassSubjectId.clear() },
  school: (ctx: ReturnType<typeof publishedContext>) => { ctx.school = new School({ ...ctx.school.data, name: 'Changed' }) },
}

for (const [field, mutate] of Object.entries(changes)) {
  for (const phase of ['render', 'storage']) {
    test(`rejects a changed ${field} after ${phase} without publishing an attachment`, async () => {
      const ctx = publishedContext()
      const save = mock(async () => {})
      const putObject = mock(async () => {
        if (phase === 'storage')
          mutate(ctx)
        return { sizeBytes: 4096 }
      })
      const service = { baseService: {
        actor: { kind: 'staff', schoolId: ctx.school.id, staffMemberId: 'staff' },
        access: { reportCards: { documentContext: async () => ctx, assertDocumentAttachment: async () => ctx } },
        atomicExecution: { execute: (work: () => Promise<unknown>) => work() },
        repositories: {
          attachments: { forAccess: () => ({ findById: async () => undefined, save }) },
          results: { findById: async () => ctx.result },
          students: { findById: async () => ctx.student },
          privateFiles: { reserve: async () => {} },
        },
        fileStorage: { putObject },
      } } as unknown as SchoolService
      const renderer = { render: async () => {
        if (phase === 'render')
          mutate(ctx)
        return { bytes: new Uint8Array(4096), sha256: 'hash', renderId: 'render', contentType: 'application/pdf' as const }
      } }
      await expect(renderReportCardDocument(service, { resultId: ctx.result.id, renderer }))
        .rejects
        .toMatchObject({ code: 'REPORT_DOCUMENT_SOURCE_CHANGED' })
      expect(putObject).toHaveBeenCalledTimes(phase === 'storage' ? 1 : 0)
      expect(save).not.toHaveBeenCalled()
    })
  }
}
