/* eslint-disable dot-notation -- TypeScript requires bracket access for command-owned payload index signatures. */
import type { AttendanceRecord, DocumentRendererPort } from '@edaya/core'
import { ActorAssuranceLevel, createStaffActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { AttendanceJustificationStatus, AttendanceMode, AttendanceStatus, ClassGroup, ClassSubjectMatter, ClassSubjectMatterStatus, DocumentIssuanceStatus, Incident, IncidentInvolvementRole, IncidentKind, LessonSession, Permission, ReportCardDefinitionSectionKind, ReportCardResult, ReportCardResultSection, ReportCardResultStatus, StaffMember, StaffPermissionAssignment, Student, StudentClassEnrollment, StudentIncidentInvolvement, SubjectMatter, Teacher, TeacherAssignment, TeacherAssignmentKind } from '@edaya/core'
import { dispatchDocumentRender } from '@edaya/service'
import { describe, expect, test } from 'bun:test'
import { createReportCardContext } from './report-card-workflow-context'

async function fixture(documentRenderer?: DocumentRendererPort) {
  const f = await createReportCardContext({ documentRenderer })
  await f.repositories.teachers.save(new Teacher({ id: 'teacher1', schoolId: 'sch1', firstName: 'Ada', lastName: 'Teacher', subjectId: 'teacher-subject' }))
  for (const [id, kind] of [['subject', TeacherAssignmentKind.Subject], ['homeroom', TeacherAssignmentKind.Homeroom]] as const) await f.repositories.teacherAssignments.save(new TeacherAssignment({ id, teacherId: 'teacher1', academicYearId: 'ay1', classGroupId: 'cg1', classSubjectId: kind === TeacherAssignmentKind.Subject ? 'cs1' : undefined, kind }))
  const teacher = f.forActor(createTeacherActorMetadata({ schoolId: 'sch1', teacherId: 'teacher1', subjectId: 'teacher-subject', academicYearId: 'ay1', requestId: 'teacher', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
  await f.repositories.staffMembers.save(new StaffMember({ id: 'reviewer', schoolId: 'sch1', firstName: 'Review', lastName: 'Staff', subjectId: 'reviewer-subject' }))
  for (const permission of [Permission.ATTENDANCE_VALIDATE, Permission.CLASS_LOGBOOK_VALIDATE, Permission.DISCIPLINE_VALIDATE, Permission.REPORT_CARD_PUBLISH]) await f.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: permission, schoolId: 'sch1', staffId: 'reviewer', academicYearId: 'ay1', permission, scopes: [{ kind: 'class_group', classGroupId: 'cg1' }] }))
  const reviewer = f.forActor(createStaffActorMetadata({ schoolId: 'sch1', staffMemberId: 'reviewer', subjectId: 'reviewer-subject', academicYearId: 'ay1', requestId: 'reviewer', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
  return { ...f, teacher, reviewer }
}

describe('teacher corrections across workflows', () => {
  test('attendance drafts stay private; finishing requires every student and publishes once', async () => {
    const f = await fixture()
    const now = new Date()
    await f.repositories.lessonSessions.save(new LessonSession({ id: 'new-call', schoolId: 'sch1', classGroupId: 'cg1', classSubjectId: 'cs1', displayLabel: 'Math', startsAt: new Date(now.getTime() - 60000), endsAt: new Date(now.getTime() + 3600000) }))
    const input = { requestId: 'draft', expectedVersion: 0, anchor: { kind: 'lesson' as const, lessonSessionId: 'new-call' }, entries: [{ studentId: 'stu1', status: 'absent' as const }] }
    const draft = await f.teacher.teacherCorrectionsWorkflow.attendanceCall('save', input)
    expect(await f.repositories.attendance.count({ lessonSessionId: 'new-call' })).toBe(0)
    expect(draft.locked).toBe(false)
    const submission = { ...input, requestId: 'finish', expectedVersion: 1 }
    await f.teacher.teacherCorrectionsWorkflow.attendanceCall('submit', submission)
    await f.teacher.teacherCorrectionsWorkflow.attendanceCall('submit', submission)
    expect(await f.repositories.attendance.count({ lessonSessionId: 'new-call' })).toBe(1)
    const record = (await f.repositories.attendance.findOne({ lessonSessionId: 'new-call' }))!
    await f.teacher.teacherCorrectionsWorkflow.recordArrival({ requestId: 'arrived', recordId: record.id, expectedVersion: 1, occurredAt: now })
    expect((await f.repositories.attendance.findById(record.id))?.status).toBe(AttendanceStatus.Late)
    const state = await f.repositories.teacherCorrections.state('sch1', 'attendance', record.id)
    expect(state?.history.map(h => h.action)).toEqual(['initial_submission', 'arrival'])
    expect((state?.payload['original'] as AttendanceRecord['data']).status).toBe(AttendanceStatus.Absent)
    await expect(f.teacher.teacherCorrectionsWorkflow.attendanceCall('save', { ...input, requestId: 'late-draft', expectedVersion: 2 })).rejects.toMatchObject({ code: 'CORRECTION_REQUIRED' })
  })

  test('reviewed attendance requires consequence confirmation and retains the original decision', async () => {
    const f = await fixture()
    const proposal = { workflow: 'attendance' as const, targetId: 'attendance-1', status: 'present' as const, notes: null, teacherExplanation: 'Entry error' }
    const row = await f.teacher.teacherCorrectionsWorkflow.request({ requestId: 'request', expectedVersion: 0, reason: 'Checked register', proposal })
    expect((await f.repositories.attendance.findById('attendance-1'))?.justificationStatus).toBe(AttendanceJustificationStatus.Excused)
    expect(row.consequences).toContain('supersede_attendance_justification')
    await expect(f.reviewer.teacherCorrectionsWorkflow.decide('approve', { requestId: 'approve', correctionId: row.id, expectedVersion: 0 })).rejects.toMatchObject({ code: 'CORRECTION_CONFIRM_CONSEQUENCES' })
    await f.reviewer.teacherCorrectionsWorkflow.decide('approve', { requestId: 'approve-confirmed', correctionId: row.id, expectedVersion: 0, confirmConsequences: true })
    expect((await f.repositories.attendance.findById('attendance-1'))?.status).toBe(AttendanceStatus.Present)
    const detail = await f.reviewer.teacherCorrectionsWorkflow.detail({ correctionId: row.id })
    expect(((detail.original as Record<string, unknown> | undefined)?.['snapshot'] as AttendanceRecord['data']).justificationStatus).toBe(AttendanceJustificationStatus.Excused)
  })

  test('revision is one action, preserves prior proposal and rejects stale decisions', async () => {
    const f = await fixture()
    const proposal = { workflow: 'attendance' as const, targetId: 'attendance-0', status: 'absent' as const, notes: null, teacherExplanation: null }
    const row = await f.teacher.teacherCorrectionsWorkflow.request({ requestId: 'request', expectedVersion: 0, reason: 'Checked register', proposal })
    const revised = await f.teacher.teacherCorrectionsWorkflow.revise({ requestId: 'revise', correctionId: row.id, expectedVersion: 0, reason: 'Checked with family', proposal: { ...proposal, status: 'late' } })
    expect(revised.revisions[0]?.proposal).toEqual(proposal)
    await expect(f.reviewer.teacherCorrectionsWorkflow.decide('approve', { requestId: 'stale', correctionId: row.id, expectedVersion: 0 })).rejects.toMatchObject({ code: 'CORRECTION_VERSION_CONFLICT' })
    await f.reviewer.teacherCorrectionsWorkflow.decide('reject', { requestId: 'reject', correctionId: row.id, expectedVersion: 1, reason: 'Check the original register' })
    expect((await f.repositories.attendance.findById('attendance-0'))?.status).toBe(AttendanceStatus.Present)
  })

  test('logbook validation is explicit; approval updates content and progress atomically', async () => {
    const f = await fixture()
    await f.repositories.subjectMatters.save(new SubjectMatter({ id: 'sm1', subjectId: 'subject-math', name: 'Numbers', sequenceOrder: 1 }))
    await f.repositories.classSubjectMatters.save(new ClassSubjectMatter({ id: 'matter1', classSubjectId: 'cs1', subjectMatterId: 'sm1', status: ClassSubjectMatterStatus.NotStarted, completedPercentage: 0 }))
    const proposal = { workflow: 'logbook' as const, targetId: 'session-0', sessionNote: 'Introduction', progress: [{ matterId: 'matter1', completedPercentage: 80 }] }
    const state = await f.teacher.teacherCorrectionsWorkflow.saveLogbook({ requestId: 'save', expectedVersion: 0, proposal })
    expect(state.locked).toBe(false)
    await f.teacher.getTeacherWorkflowState({ proposal })
    expect((await f.repositories.teacherCorrections.state('sch1', 'logbook', 'session-0'))?.locked).toBe(false)
    await f.reviewer.teacherCorrectionsWorkflow.validateLogbook({ requestId: 'validate', lessonSessionIds: ['session-0'] })
    await expect(f.teacher.teacherCorrectionsWorkflow.saveLogbook({ requestId: 'bypass', expectedVersion: 2, proposal })).rejects.toMatchObject({ code: 'CORRECTION_REQUIRED' })
    const row = await f.teacher.teacherCorrectionsWorkflow.request({ requestId: 'correction', expectedVersion: 2, reason: 'Wrong progress', proposal: { ...proposal, sessionNote: 'Revised introduction', progress: [{ matterId: 'matter1', completedPercentage: 40 }] } })
    await f.reviewer.teacherCorrectionsWorkflow.decide('approve', { requestId: 'approve', correctionId: row.id, expectedVersion: 0 })
    expect((await f.repositories.lessonSessions.findById('session-0'))?.sessionNote).toBe('Revised introduction')
    expect((await f.repositories.classSubjectMatters.findById('matter1'))?.completedPercentage).toBe(40)
    expect((await f.repositories.classSubjects.findById('cs1'))?.completedPercentage).toBe(40)
  })

  test('incident authors edit until takeover; follow-ups retain immutable original facts', async () => {
    const f = await fixture()
    await f.repositories.incidents.save(new Incident({ id: 'incident1', schoolId: 'sch1', classGroupId: 'cg1', reporterId: 'teacher1', title: 'Incident', description: 'Initial facts', kind: IncidentKind.MinorInfraction, date: new Date() }))
    await f.repositories.studentIncidentInvolvements.save(new StudentIncidentInvolvement({ id: 'involved', incidentId: 'incident1', studentId: 'stu1', role: IncidentInvolvementRole.Subject }))
    const proposal = { workflow: 'discipline' as const, targetId: 'incident1', title: 'Incident', description: 'Checked facts', kind: 'minor_infraction' as const, studentIds: ['stu1'] }
    await f.teacher.teacherCorrectionsWorkflow.editIncident({ requestId: 'edit', expectedVersion: 0, proposal })
    await f.reviewer.teacherCorrectionsWorkflow.takeOverIncident({ requestId: 'takeover', incidentId: 'incident1' })
    await expect(f.teacher.teacherCorrectionsWorkflow.editIncident({ requestId: 'bypass', expectedVersion: 2, proposal })).rejects.toMatchObject({ code: 'CORRECTION_REQUIRED' })
    const pending = await f.teacher.teacherCorrectionsWorkflow.request({ requestId: 'incident-correction', expectedVersion: 2, reason: 'Checked original facts', proposal: { ...proposal, description: 'Corrected facts' } })
    await f.teacher.teacherCorrectionsWorkflow.appendFollowUp({ requestId: 'follow-up', incidentId: 'incident1', text: 'Family contacted' })
    expect((await f.repositories.incidents.findById('incident1'))?.description).toBe('Checked facts')
    expect((await f.repositories.teacherCorrections.state('sch1', 'discipline', 'incident1'))?.history.at(-1)?.action).toBe('follow_up')
    await f.reviewer.teacherCorrectionsWorkflow.decide('approve', { requestId: 'incident-approve', correctionId: pending.id, expectedVersion: 0 })
    expect((await f.repositories.incidents.findById('incident1'))?.description).toBe('Corrected facts')
  })
  test('reading an authored incident preserves past participants after their enrollment ends', async () => {
    const f = await fixture()
    await f.repositories.incidents.save(new Incident({ id: 'historic-incident', schoolId: 'sch1', classGroupId: 'cg1', reporterId: 'teacher1', title: 'Historic', description: 'Original account', kind: IncidentKind.MinorInfraction, date: new Date('2026-02-05') }))
    const initial = { workflow: 'discipline' as const, targetId: 'historic-incident', title: 'Historic', description: 'Original account', kind: 'minor_infraction' as const, studentIds: [] }
    expect((await f.teacher.getTeacherWorkflowState({ proposal: initial })).official).toMatchObject({ studentIds: [] })
    await f.repositories.studentIncidentInvolvements.save(new StudentIncidentInvolvement({ id: 'historic-involvement', incidentId: 'historic-incident', studentId: 'stu1', role: IncidentInvolvementRole.Subject }))
    await f.repositories.enrollments.delete('enr1')
    const proposal = { workflow: 'discipline' as const, targetId: 'historic-incident', title: 'Historic', description: 'Clarified account', kind: 'minor_infraction' as const, studentIds: ['stu1'] }
    const state = await f.teacher.getTeacherWorkflowState({ proposal })
    expect(state.locked).toBe(false)
    expect(state.context.students[0]?.id).toBe('stu1')
    expect(state.context.students[0]?.name).toBeTruthy()
    await f.teacher.teacherCorrectionsWorkflow.editIncident({ requestId: 'historic-edit', expectedVersion: 0, proposal })
    expect((await f.repositories.incidents.findById('historic-incident'))?.description).toBe('Clarified account')
    await expect(f.teacher.teacherCorrectionsWorkflow.editIncident({ requestId: 'foreign-participant', expectedVersion: 1, proposal: { ...proposal, studentIds: ['stu1', 'foreign-student'] } })).rejects.toThrow()
  })

  test('an incomplete daily call cannot publish; a transferred student remains on the submitted roster', async () => {
    const f = await fixture()
    const group = (await f.repositories.classGroups.findById('cg1'))!
    await f.repositories.classGroups.save(new ClassGroup({ ...group.data, attendanceMode: AttendanceMode.Daily }))
    await f.repositories.students.save(new Student({ id: 'stu2', schoolId: 'sch1', firstName: 'Second', lastName: 'Student' }))
    await f.repositories.enrollments.save(new StudentClassEnrollment({ id: 'enr2', studentId: 'stu2', classGroupId: 'cg1', academicYearId: 'ay1', enrollmentIndex: 1, enrolledAt: new Date('2025-09-01') }))
    const anchor = { kind: 'daily' as const, classGroupId: 'cg1', date: new Date('2026-02-05') }
    const draft = await f.teacher.teacherCorrectionsWorkflow.attendanceCall('save', { requestId: 'daily-draft', expectedVersion: 0, anchor, entries: [{ studentId: 'stu1', status: 'absent' }] })
    await expect(f.teacher.teacherCorrectionsWorkflow.attendanceCall('submit', { requestId: 'incomplete', expectedVersion: draft.version, anchor, entries: [] })).rejects.toMatchObject({ code: 'ATTENDANCE_INCOMPLETE' })
    expect(await f.repositories.attendances.count()).toBe(0)
    await f.teacher.teacherCorrectionsWorkflow.attendanceCall('submit', { requestId: 'complete', expectedVersion: draft.version, anchor, entries: [{ studentId: 'stu2', status: 'present' }] })
    await f.repositories.enrollments.delete('enr2')
    const call = await f.teacher.getTeacherAttendanceCall({ anchor })
    expect(call.submitted).toBe(true)
    expect(call.students.map(s => s.id).sort()).toEqual(['stu1', 'stu2'])
    expect(call.entries).toEqual(expect.arrayContaining([expect.objectContaining({ studentId: 'stu1', status: 'absent' })]))
  })

  test('queue counts, filters and detail respect the reviewer class scope and prevent self-review across profiles', async () => {
    const f = await fixture()
    const proposal = { workflow: 'attendance' as const, targetId: 'attendance-0', status: 'absent' as const, notes: null, teacherExplanation: null }
    const row = await f.teacher.teacherCorrectionsWorkflow.request({ requestId: 'scoped-request', expectedVersion: 0, reason: 'Checked original', proposal })
    await f.repositories.teacherCorrections.save({ ...row, id: 'outside', targetId: 'outside', classGroupId: 'cg2' })
    const queue = await f.reviewer.listTeacherCorrections({ status: 'pending', limit: 1 })
    expect(queue.total).toBe(1)
    expect(queue.items.map(r => r.id)).toEqual([row.id])
    expect(queue.filters.classes).toEqual([{ value: 'cg1', label: 'Class 1' }])
    expect(queue.filters.teachers).toEqual([{ value: 'teacher-subject', label: 'Ada Teacher' }])
    await expect(f.reviewer.getTeacherCorrection({ correctionId: 'outside' })).rejects.toBeDefined()
    expect((await f.reviewer.listTeacherCorrections({ studentId: 'other' })).total).toBe(0)
    await f.repositories.staffMembers.save(new StaffMember({ id: 'teacher-staff', schoolId: 'sch1', subjectId: 'teacher-subject', firstName: 'Ada', lastName: 'Teacher' }))
    await f.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'self-grant', schoolId: 'sch1', academicYearId: 'ay1', staffId: 'teacher-staff', permission: Permission.ATTENDANCE_VALIDATE, scopes: [{ kind: 'school' }] }))
    const self = f.forActor(createStaffActorMetadata({ schoolId: 'sch1', staffMemberId: 'teacher-staff', subjectId: 'teacher-subject', academicYearId: 'ay1', requestId: 'self', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
    await expect(self.teacherCorrectionsWorkflow.decide('approve', { requestId: 'self-approve', correctionId: row.id, expectedVersion: 0 })).rejects.toBeDefined()
  })

  test('published comment revisions retain report facts and the original PDF until rendering succeeds', async () => {
    let unavailable = false
    const f = await fixture({ async render() {
      if (unavailable)
        throw new Error('Renderer unavailable')
      return { bytes: new TextEncoder().encode('%PDF-1.4 correction'), contentType: 'application/pdf', sha256: 'a'.repeat(64), renderId: 'revision-render' }
    } })
    const report = new ReportCardResult({ id: 'report1', reportCardDefinitionId: 'def1', studentId: 'stu1', classGroupId: 'cg1', periodId: 'per1', status: ReportCardResultStatus.Published, publishedAt: new Date('2026-04-01'), overallAverage: 16, rank: 1, classSize: 30, teacherComment: 'Original general comment', assessmentResultCount: 1, attendanceSummary: { presentCount: 2, absenceCount: 1, excusedAbsenceCount: 1, lateCount: 0 }, sectionResults: [new ReportCardResultSection({ sectionId: 'sec-math', sectionKind: ReportCardDefinitionSectionKind.Subject, name: 'Math', classSubjectId: 'cs1', average: 16, weight: 1, comment: 'Original subject comment', subResults: [] })] })
    await f.repositories.results.save(report)
    const original = await f.service.documentsWorkflow.requestDocumentIssuance({ requestId: 'original-document', templateKey: 'report-card.v1', sourceId: report.id })
    await dispatchDocumentRender(f.application)
    expect((await f.repositories.documentIssuances.findById(original.id))?.status).toBe(DocumentIssuanceStatus.Ready)
    const proposal = { workflow: 'report_comments' as const, targetId: report.id, teacherComment: 'Corrected general comment', sections: [{ sectionId: 'sec-math', comment: 'Corrected subject comment' }] }
    const request = await f.teacher.teacherCorrectionsWorkflow.request({ requestId: 'comment-request', expectedVersion: 0, reason: 'Correct student feedback', proposal })
    const approved = await f.reviewer.teacherCorrectionsWorkflow.decide('approve', { requestId: 'comment-approve', correctionId: request.id, expectedVersion: 0, confirmConsequences: true })
    expect(approved.documentIssuanceId).toBeDefined()
    expect((await f.repositories.results.findById(report.id))?.teacherComment).toBe('Original general comment')
    const state = await f.repositories.teacherCorrections.state('sch1', 'report_comments', report.id)
    expect((state?.payload['snapshot'] as ReportCardResult['data']).overallAverage).toBe(16)
    expect((state?.payload['snapshot'] as ReportCardResult['data']).rank).toBe(1)
    const issuance = (await f.repositories.documentIssuances.findById(approved.documentIssuanceId!))!
    const prior = (await f.repositories.documentIssuances.findById(original.id))!
    expect(issuance.snapshot.facts['student']).toEqual(prior.snapshot.facts['student'])
    expect((issuance.snapshot.facts['subjects'] as Array<Record<string, unknown>>)[0]?.['appreciation']).toBe('Corrected subject comment')
    expect(prior.status).toBe(DocumentIssuanceStatus.Ready)
    unavailable = true
    await dispatchDocumentRender(f.application)
    expect((await f.repositories.documentIssuances.findById(original.id))?.status).toBe(DocumentIssuanceStatus.Ready)
    expect((await f.repositories.teacherCorrections.state('sch1', 'report_comments', report.id))?.payload['visibleSnapshot']).toBeUndefined()
    unavailable = false
    await f.service.documentsWorkflow.retryDocumentIssuance({ requestId: 'retry-revision', issuanceId: issuance.id })
    await dispatchDocumentRender(f.application)
    expect((await f.repositories.documentIssuances.findById(original.id))?.status).toBe(DocumentIssuanceStatus.Superseded)
    expect((await f.repositories.teacherCorrections.state('sch1', 'report_comments', report.id))?.payload['documentStatus']).toBe(DocumentIssuanceStatus.Ready)
    expect((await f.repositories.results.findById(report.id))?.teacherComment).toBe('Original general comment')
  })
})
