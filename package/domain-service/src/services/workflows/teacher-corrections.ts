import type { CommandJson, CommandOutboxFact, CorrectionProposal, CorrectionWorkflow, IncidentKind, MarksCorrection, TeacherCorrection, TeacherWorkflowState } from '@edaya/core'
/* eslint-disable dot-notation -- TypeScript requires bracket access for command-owned payload index signatures. */
import type { z } from 'zod'
import type { BaseSchoolService } from '../base-school-service'
import { AuthorizationError, denyResourceAccess } from '@edaya/authorization'
import { appendIncidentFollowUpSchema, Attendance, attendanceArrivalSchema, attendanceCallSchema, AttendanceJustificationStatus, AttendanceRecord, AttendanceStatus, BusinessRuleViolationError, ClassSubject, ClassSubjectMatter, ClassSubjectMatterStatus, ClassSubjectProgress, decideTeacherCorrectionSchema, DocumentIssuanceStatus, editTeacherIncidentSchema, Incident, IncidentInvolvementRole, LessonSession, Permission, rejectTeacherCorrectionSchema, ReportCardResult, ReportCardResultSection, ReportCardResultStatus, requestTeacherCorrectionSchema, reviseTeacherCorrectionSchema, saveTeacherLogbookSchema, StudentClassEnrollmentStatus, StudentIncidentInvolvement, takeOverTeacherIncidentSchema, teacherCorrectionSchema, teacherCorrectionsQuerySchema, validateTeacherLogbookSchema } from '@edaya/core'
import { academicStateLock } from '../../capabilities/academics/marks-state'
import { visibleReportRevision } from '../../capabilities/academics/report-comment-revisions'
import { assembleDocumentSource } from '../../capabilities/documents/assemble-document-source'
import { REPORT_CARD_TEMPLATE_KEY } from '../../capabilities/documents/catalog'
import { DOCUMENT_RENDER_KIND } from '../../capabilities/documents/durable-document-render'
import { persistRequestedIssuance } from '../../capabilities/documents/persist-requested-issuance'
import { ATTENDANCE_RECORDED_EVENT_KEY, runWorkflowNotifications } from '../../capabilities/notifications'
import { notifyTeacherCorrection } from '../../capabilities/notifications/teacher-correction-notifications'
import { normalizeCommandRequest } from '../commands/command-execution'
import { schoolCommandScope } from '../commands/school-command-scope'
import { getAssessmentMarksReview } from '../queries/marks-review'

const permissions = { attendance: Permission.ATTENDANCE_VALIDATE, report_comments: Permission.REPORT_CARD_PUBLISH, logbook: Permission.CLASS_LOGBOOK_VALIDATE, discipline: Permission.DISCIPLINE_VALIDATE } as const
const equal = (a: unknown, b: unknown) => normalizeCommandRequest(JSON.parse(JSON.stringify(a ?? null))) === normalizeCommandRequest(JSON.parse(JSON.stringify(b ?? null)))
function fail(code: string, message: string): never {
  throw new BusinessRuleViolationError(code, message)
}
/** Explicit adapters constrain editable fields; approvals never execute arbitrary entity patches. */
export class TeacherCorrectionsWorkflow {
  constructor(private readonly base: BaseSchoolService) {}
  private get repositories() { return this.base.repositories }
  private get actor() { return this.base.actor }
  private human() {
    if (this.actor.kind !== 'teacher' && this.actor.kind !== 'staff')
      denyResourceAccess()
    return this.actor
  }

  private state(workflow: CorrectionWorkflow, targetId: string) { return this.repositories.teacherCorrections.state(this.actor.schoolId, workflow, targetId) }
  private async remember(workflow: CorrectionWorkflow, targetId: string, action: string, payload: Record<string, unknown>, locked?: boolean) {
    const previous = await this.state(workflow, targetId)
    const state: TeacherWorkflowState = { schoolId: this.actor.schoolId, workflow, targetId, version: (previous?.version ?? 0) + 1, locked: locked ?? previous?.locked ?? false, payload, history: [...previous?.history ?? [], { at: new Date().toISOString(), subjectId: this.human().subjectId, action, payload }] }
    await this.repositories.teacherCorrections.saveState(state)
    return state
  }

  private async run<T>(command: string, input: { requestId: string }, authorize: () => Promise<unknown>, execute: () => Promise<T>, outbox?: (result: T) => readonly CommandOutboxFact[]) {
    this.human()
    return this.base.commandExecution.execute({ scope: await schoolCommandScope(this.actor, command, input.requestId), input, resultMode: 'ordinary', lockKeys: [academicStateLock(this.actor.schoolId)], authorize: async () => {
      await authorize()
    }, execute, persistResult: result => JSON.parse(JSON.stringify(result)) as CommandJson, replay: async (stored) => {
      if (stored && !Array.isArray(stored) && typeof stored === 'object' && 'id' in stored && 'status' in stored)
        return teacherCorrectionSchema.parse(stored) as T
      return stored as T
    }, outbox, audit: () => [{ event: command, resourceType: 'teacher-correction', resourceId: input.requestId }] })
  }

  private async target(proposal: CorrectionProposal) {
    const { workflow, targetId } = proposal
    const state = await this.state(workflow, targetId)
    if (workflow === 'attendance') {
      const row = await this.repositories.attendance.forSchool!(this.actor.schoolId).findById(targetId)
      if (!row)
        denyResourceAccess()
      const lesson = row.lessonSessionId ? await this.repositories.lessonSessions.findById(row.lessonSessionId) : undefined
      const daily = row.attendanceId ? await this.repositories.attendances.findById(row.attendanceId) : undefined
      const classGroupId = lesson?.classGroupId ?? daily?.classGroupId
      if (!classGroupId)
        denyResourceAccess()
      const before: CorrectionProposal = { workflow, targetId, status: row.status, notes: row.notes ?? null, teacherExplanation: typeof state?.payload['teacherExplanation'] === 'string' ? state.payload['teacherExplanation'] : null }
      return { classGroupId, studentIds: [row.studentId], before, version: state?.version ?? 0, locked: true, consequences: row.justificationStatus !== AttendanceJustificationStatus.None && proposal.status !== row.status ? ['supersede_attendance_justification'] : [], snapshot: row.data }
    }
    if (workflow === 'logbook') {
      const row = await this.repositories.lessonSessions.forSchool!(this.actor.schoolId).findById(targetId)
      if (!row)
        denyResourceAccess()
      const progress = await this.repositories.classSubjectProgress.list({ lessonSessionId: targetId })
      const before: CorrectionProposal = { workflow, targetId, sessionNote: row.sessionNote ?? null, progress: progress.map(p => ({ matterId: p.classSubjectMatterId, completedPercentage: p.completedPercentage })).sort((a, b) => a.matterId.localeCompare(b.matterId)) }
      return { classGroupId: row.classGroupId, studentIds: [], before, version: state?.version ?? 0, locked: state?.locked ?? false, consequences: [], snapshot: before }
    }
    if (workflow === 'discipline') {
      const row = await this.repositories.incidents.forSchool!(this.actor.schoolId).findById(targetId)
      if (!row || !row.classGroupId)
        denyResourceAccess()
      const participants = await this.repositories.studentIncidentInvolvements.list({ incidentId: targetId })
      const studentIds = participants.map(p => p.studentId).sort()
      const actions = await this.repositories.studentDisciplinaryActions.list({ incidentId: targetId })
      const before: CorrectionProposal = { workflow, targetId, title: row.title, description: row.description, kind: row.kind, studentIds }
      return { classGroupId: row.classGroupId, studentIds, before, version: state?.version ?? 0, locked: state?.locked || row.status !== 'open' || actions.length > 0, consequences: actions.length || row.status !== 'open' ? ['review_discipline_outcomes'] : [], snapshot: { ...row.data, participants: participants.map(p => p.data), actions: actions.map(a => a.data) } }
    }
    const original = await this.repositories.results.forSchool!(this.actor.schoolId).findById(targetId)
    if (!original)
      denyResourceAccess()
    const row = visibleReportRevision(original, state)
    const collect = (nodes: readonly ReportCardResultSection[]): Array<{ sectionId: string, comment: string | null }> => nodes.flatMap(node => [{ sectionId: node.sectionId, comment: node.comment ?? null }, ...collect(node.subResults)])
    const all = collect(row.sectionResults)
    for (const section of proposal.sections) {
      if (!all.some(s => s.sectionId === section.sectionId))
        fail('REPORT_CARD_COMMENT_INVALID_SECTION', 'A section does not belong to this report')
    }
    const before: CorrectionProposal = { workflow, targetId, ...('teacherComment' in proposal ? { teacherComment: row.teacherComment ?? null } : {}), sections: proposal.sections.map(p => all.find(s => s.sectionId === p.sectionId)!) }
    return { classGroupId: row.classGroupId, studentIds: [row.studentId], periodId: row.periodId, before, version: state?.version ?? row.version, locked: row.status === ReportCardResultStatus.Published, consequences: ['replace_published_report'], snapshot: row.data }
  }

  private patchComments(row: ReportCardResult, proposal: Extract<CorrectionProposal, { workflow: 'report_comments' }>) {
    const comments = new Map(proposal.sections.map(p => [p.sectionId, p.comment?.trim() || undefined]))
    if (comments.size !== proposal.sections.length)
      fail('DUPLICATE_COMMENT', 'Each section may appear only once')
    const patch = (nodes: readonly ReportCardResultSection[]): ReportCardResultSection[] => nodes.map(node => new ReportCardResultSection({ ...node.data, comment: comments.has(node.sectionId) ? comments.get(node.sectionId) : node.comment, subResults: patch(node.subResults) }))
    return new ReportCardResult({ ...row.data, sectionResults: patch(row.sectionResults), ...('teacherComment' in proposal ? { teacherComment: proposal.teacherComment ?? undefined } : {}) })
  }

  private async authorizeProposal(proposal: CorrectionProposal) {
    const actor = this.human()
    if (proposal.workflow === 'attendance') {
      const row = await this.repositories.attendance.forSchool!(actor.schoolId).findById(proposal.targetId)
      if (!row)
        denyResourceAccess()
      await this.base.access.teacherCorrections.assertAttendanceRecord(row.id)
    }
    if (proposal.workflow === 'logbook') {
      await this.base.access.teacherCorrections.assertLogbookProposal(proposal.targetId, proposal.progress.map(p => p.matterId))
    }
    if (proposal.workflow === 'discipline') {
      await this.base.access.teacherCorrections.assertIncidentProposal(proposal.targetId, proposal.studentIds)
    }
    if (proposal.workflow === 'report_comments') {
      const row = await this.repositories.results.forSchool!(actor.schoolId).findById(proposal.targetId)
      if (!row)
        denyResourceAccess()
      await this.base.access.assertReportCommentProposal(this.patchComments(row, proposal), row)
    }
  }

  async request(raw: z.input<typeof requestTeacherCorrectionSchema>) {
    const input = requestTeacherCorrectionSchema.parse(raw)
    return this.run('requestTeacherCorrection', input, () => this.authorizeProposal(input.proposal), async () => {
      const target = await this.target(input.proposal)
      const currentState = await this.state(input.proposal.workflow, input.proposal.targetId)
      if (input.proposal.workflow === 'report_comments' && currentState?.payload['documentStatus'] === 'requested')
        fail('REPORT_REVISION_PENDING', 'Wait for the revised report document before requesting another correction')
      if (!target.locked)
        fail('CORRECTION_NOT_REQUIRED', 'Save this entry directly until it is submitted or validated')
      if (target.version !== input.expectedVersion)
        fail('CORRECTION_SOURCE_CHANGED', 'The record changed; reload before requesting a correction')
      if (equal(target.before, input.proposal))
        fail('CORRECTION_UNCHANGED', 'The proposed values are unchanged')
      if ((await this.repositories.teacherCorrections.forTarget(this.actor.schoolId, input.proposal.workflow, input.proposal.targetId)).some(row => row.status === 'pending'))
        fail('CORRECTION_PENDING', 'Revise or withdraw the existing pending request')
      const row: TeacherCorrection = { id: crypto.randomUUID(), schoolId: this.actor.schoolId, workflow: input.proposal.workflow, targetId: input.proposal.targetId, classGroupId: target.classGroupId, studentIds: target.studentIds, ...('periodId' in target ? { periodId: target.periodId } : {}), status: 'pending', version: 0, baseVersion: target.version, authorSubjectId: this.human().subjectId, reason: input.reason, before: target.before, proposal: input.proposal, consequences: target.consequences, createdAt: new Date(), revisions: [] }
      // Preserve staff justification decisions, original participants and published facts for the reviewer.
      await this.remember(row.workflow, `correction:${row.id}`, 'requested', { snapshot: target.snapshot }, true)
      await this.repositories.teacherCorrections.save(row)
      await notifyTeacherCorrection(this.base, row, 'requested', permissions[row.workflow])
      return row
    })
  }

  private async require(id: string) {
    const row = await this.repositories.teacherCorrections.find(this.actor.schoolId, id)
    if (!row)
      denyResourceAccess()
    return row
  }

  async revise(raw: z.input<typeof reviseTeacherCorrectionSchema>) {
    const input = reviseTeacherCorrectionSchema.parse(raw)
    return this.run('reviseTeacherCorrection', input, async () => {
      const row = await this.require(input.correctionId)
      if (row.authorSubjectId !== this.human().subjectId || row.targetId !== input.proposal.targetId || row.workflow !== input.proposal.workflow)
        denyResourceAccess()
      await this.authorizeProposal(input.proposal)
    }, async () => {
      const row = await this.require(input.correctionId)
      if (row.status !== 'pending' || row.version !== input.expectedVersion)
        fail('CORRECTION_VERSION_CONFLICT', 'The request changed; reload it')
      const target = await this.target(input.proposal)
      if (target.version !== row.baseVersion || !equal(target.before, row.before))
        fail('CORRECTION_SOURCE_CHANGED', 'The official record changed')
      if (equal(target.before, input.proposal))
        fail('CORRECTION_UNCHANGED', 'The proposed values are unchanged')
      const revised: TeacherCorrection = { ...row, version: row.version + 1, reason: input.reason, proposal: input.proposal, revisions: [...row.revisions, { version: row.version, reason: row.reason, before: row.before, proposal: row.proposal, at: new Date() }] }
      await this.repositories.teacherCorrections.save(revised)
      await notifyTeacherCorrection(this.base, revised, 'revised', permissions[revised.workflow])
      return revised
    })
  }

  async decide(action: 'approve' | 'reject' | 'withdraw', raw: z.input<typeof decideTeacherCorrectionSchema> | z.input<typeof rejectTeacherCorrectionSchema>) {
    let documentIssuanceId: string | undefined
    const input = action === 'reject' ? rejectTeacherCorrectionSchema.parse(raw) : decideTeacherCorrectionSchema.parse(raw)
    return this.run(`${action}TeacherCorrection`, input, async () => {
      const row = await this.require(input.correctionId)
      const actor = this.human()
      if (action === 'withdraw') {
        if (row.authorSubjectId !== actor.subjectId)
          denyResourceAccess()
        await this.authorizeProposal(row.proposal)
      }
      else {
        if (actor.kind !== 'staff' || row.authorSubjectId === actor.subjectId)
          denyResourceAccess()
        await this.base.access.teacherCorrections.assertReview(row.workflow, row.classGroupId)
      }
    }, async () => {
      const row = await this.require(input.correctionId)
      if (row.status !== 'pending' || row.version !== input.expectedVersion)
        fail('CORRECTION_VERSION_CONFLICT', 'The request changed; reload it')
      if (action === 'approve') {
        const target = await this.target(row.proposal)
        const original = await this.state(row.workflow, `correction:${row.id}`)
        if (target.version !== row.baseVersion || !equal(target.before, row.before) || !equal(target.snapshot, original?.payload['snapshot']))
          fail('CORRECTION_SOURCE_CHANGED', 'The official record or staff decision changed; request a fresh correction')
        if (row.consequences.some(c => c !== 'review_discipline_outcomes') && !input.confirmConsequences)
          fail('CORRECTION_CONFIRM_CONSEQUENCES', 'Confirm the displayed justification or document consequence')
        documentIssuanceId = await this.apply(row.proposal)
      }
      const decided: TeacherCorrection = { ...row, version: row.version + 1, status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'withdrawn', decidedAt: new Date(), decidedBy: this.human().subjectId, ...('reason' in input && typeof input.reason === 'string' ? { rejectionReason: input.reason } : {}) }
      await this.repositories.teacherCorrections.save(decided)
      if (action !== 'withdraw')
        await notifyTeacherCorrection(this.base, decided, action === 'approve' ? 'approved' : 'rejected', permissions[decided.workflow])
      return { ...decided, ...(documentIssuanceId ? { documentIssuanceId } : {}) }
    }, result => 'documentIssuanceId' in result && typeof result.documentIssuanceId === 'string' ? [{ id: result.documentIssuanceId, kind: DOCUMENT_RENDER_KIND, version: 1, resourceType: 'document-issuance', resourceId: result.documentIssuanceId }] : [])
  }

  private async apply(proposal: CorrectionProposal): Promise<string | undefined> {
    const before = await this.target(proposal)
    if (proposal.workflow === 'attendance') {
      const record = await this.repositories.attendance.findById(proposal.targetId)
      if (!record)
        denyResourceAccess()
      const changedStatus = record.status !== proposal.status
      const next = new AttendanceRecord({ ...record.data, status: proposal.status as AttendanceStatus, notes: proposal.notes ?? undefined, ...(changedStatus ? { justificationStatus: AttendanceJustificationStatus.None, reason: undefined, justifiedAt: undefined, justifiedByStaffId: undefined } : {}), correctedAt: new Date(), correctedByStaffId: this.human().actorId, updatedAt: new Date() })
      await this.repositories.attendance.save(next)
      const student = await this.repositories.students.findById(record.studentId)
      if (student)
        await runWorkflowNotifications(this.base, ATTENDANCE_RECORDED_EVENT_KEY, { records: [next], schoolId: this.actor.schoolId, correction: true })
    }
    if (proposal.workflow === 'logbook')
      await this.applyLogbook(proposal)
    if (proposal.workflow === 'discipline') {
      const record = await this.repositories.incidents.findById(proposal.targetId)
      if (!record)
        denyResourceAccess()
      await this.repositories.incidents.save(new Incident({ ...record.data, title: proposal.title, description: proposal.description ?? '', kind: proposal.kind as IncidentKind, updatedAt: new Date() }))
      const participants = await this.repositories.studentIncidentInvolvements.list({ incidentId: record.id })
      for (const participant of participants) {
        if (!proposal.studentIds.includes(participant.studentId))
          await this.repositories.studentIncidentInvolvements.delete(participant.id)
      }
      for (const studentId of proposal.studentIds) {
        if (!participants.some(p => p.studentId === studentId))
          await this.repositories.studentIncidentInvolvements.save(new StudentIncidentInvolvement({ id: crypto.randomUUID(), incidentId: record.id, studentId, role: IncidentInvolvementRole.Subject }))
      }
    }
    if (proposal.workflow === 'report_comments') {
      const record = await this.repositories.results.findById(proposal.targetId)
      if (!record)
        denyResourceAccess()
      const current = await this.state('report_comments', record.id)
      const official = visibleReportRevision(record, current)
      const revised = this.patchComments(official, proposal)
      const stored = new ReportCardResult({ ...revised.data, sectionResults: [...revised.sectionResults], version: Math.max(record.version, current?.version ?? 0) + 1 })
      const revision = await this.remember(proposal.workflow, proposal.targetId, 'published_comment_revision', { ...current?.payload, snapshot: stored.data, previousSnapshot: official.data, documentStatus: 'requested' }, true)
      // The document renderer reads the revision, while family reads retain the last ready snapshot.
      revision.version = stored.version
      await this.repositories.teacherCorrections.saveState(revision)
      const documents = await this.repositories.documentIssuances.forSchool!(this.actor.schoolId).list({ sourceId: record.id, status: DocumentIssuanceStatus.Ready })
      const templateKey = documents.some(document => document.templateKey === 'annual-report-card.v1') ? 'annual-report-card.v1' : REPORT_CARD_TEMPLATE_KEY
      const previous = documents.filter(document => document.templateKey === templateKey).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
      const assembled = await assembleDocumentSource(this.base, { templateKey, sourceId: record.id, locale: previous?.locale ?? 'fr' })
      const issuance = await persistRequestedIssuance(this.base, { requestId: `comment-revision:${record.id}:${stored.version}`, templateKey, locale: previous?.locale ?? 'fr', assembled, replacesIssuanceId: previous?.id, deferReplacement: true })
      await this.repositories.teacherCorrections.saveState({ ...revision, payload: { ...revision.payload, issuanceId: issuance.id } })
      return issuance.id
    }
    await this.remember(proposal.workflow, proposal.targetId, 'correction_approved', { before: before.snapshot, proposal, ...(proposal.workflow === 'attendance' ? { teacherExplanation: proposal.teacherExplanation } : {}), ...(proposal.workflow === 'discipline' ? { outcomesNeedReview: before.consequences.length > 0 } : {}) }, before.locked)
    return undefined
  }

  private async applyLogbook(proposal: Extract<CorrectionProposal, { workflow: 'logbook' }>) {
    const lesson = await this.repositories.lessonSessions.findById(proposal.targetId)
    if (!lesson)
      denyResourceAccess()
    if (new Set(proposal.progress.map(p => p.matterId)).size !== proposal.progress.length)
      fail('DUPLICATE_PROGRESS', 'Each curriculum item may appear only once')
    const existing = await this.repositories.classSubjectProgress.list({ lessonSessionId: lesson.id })
    for (const item of proposal.progress) {
      const matter = await this.repositories.classSubjectMatters.findById(item.matterId)
      if (!matter || matter.classSubjectId !== lesson.classSubjectId)
        denyResourceAccess()
      const row = existing.find(p => p.classSubjectMatterId === matter.id)
      await this.repositories.classSubjectProgress.save(new ClassSubjectProgress({ ...row?.data, id: row?.id ?? crypto.randomUUID(), lessonSessionId: lesson.id, classSubjectMatterId: matter.id, completedPercentage: item.completedPercentage }))
    }
    for (const old of existing) {
      if (!proposal.progress.some(p => p.matterId === old.classSubjectMatterId))
        await this.repositories.classSubjectProgress.delete(old.id)
    }
    await this.repositories.lessonSessions.save(new LessonSession({ ...lesson.data, sessionNote: proposal.sessionNote ?? undefined }))
    const matters = await this.repositories.classSubjectMatters.list({ classSubjectId: lesson.classSubjectId })
    for (const matter of matters) {
      const snapshots = await this.repositories.classSubjectProgress.list({ classSubjectMatterId: matter.id })
      const percentage = Math.max(0, ...snapshots.map(s => s.completedPercentage))
      const started = snapshots.filter(s => s.completedPercentage > 0).sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
      const completed = snapshots.filter(s => s.completedPercentage === 100).sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
      await this.repositories.classSubjectMatters.save(new ClassSubjectMatter({ ...matter.data, completedPercentage: percentage, status: percentage === 100 ? ClassSubjectMatterStatus.Completed : percentage > 0 ? ClassSubjectMatterStatus.InProgress : ClassSubjectMatterStatus.NotStarted, startedAt: started[0]?.recordedAt, completedAt: completed[0]?.recordedAt, updatedAt: new Date() }))
    }
    const subject = await this.repositories.classSubjects.findById(lesson.classSubjectId)
    if (subject) {
      const updated = await this.repositories.classSubjectMatters.list({ classSubjectId: subject.id })
      await this.repositories.classSubjects.save(new ClassSubject({ ...subject.data, completedPercentage: updated.length ? Math.round(updated.reduce((sum, p) => sum + p.completedPercentage, 0) / updated.length) : 0 }))
    }
  }

  async saveLogbook(raw: z.input<typeof saveTeacherLogbookSchema>) {
    const input = saveTeacherLogbookSchema.parse(raw)
    return this.run('saveTeacherLogbook', input, () => this.authorizeProposal(input.proposal), async () => {
      const target = await this.target(input.proposal)
      if (target.locked)
        fail('CORRECTION_REQUIRED', 'The logbook was validated; request a correction')
      if (target.version !== input.expectedVersion)
        fail('CORRECTION_SOURCE_CHANGED', 'The logbook changed')
      await this.applyLogbook(input.proposal)
      return this.remember('logbook', input.proposal.targetId, 'saved', { before: target.before, proposal: input.proposal }, false)
    })
  }

  async validateLogbook(raw: z.input<typeof validateTeacherLogbookSchema>) {
    const input = validateTeacherLogbookSchema.parse(raw)
    return this.run('validateTeacherLogbook', input, async () => {
      if (this.human().kind !== 'staff')
        denyResourceAccess()
      await this.base.access.teacherCorrections.assertValidateLogbook(input.lessonSessionIds)
    }, async () => {
      const states = []
      for (const id of new Set(input.lessonSessionIds)) {
        const target = await this.target({ workflow: 'logbook', targetId: id, sessionNote: null, progress: [] })
        const existing = await this.state('logbook', id)
        states.push(existing?.locked ? existing : await this.remember('logbook', id, 'validated', { snapshot: target.snapshot }, true))
      }
      return states
    })
  }

  async editIncident(raw: z.input<typeof editTeacherIncidentSchema>) {
    const input = editTeacherIncidentSchema.parse(raw)
    return this.run('editTeacherIncident', input, () => this.authorizeProposal(input.proposal), async () => {
      const target = await this.target(input.proposal)
      if (target.locked)
        fail('CORRECTION_REQUIRED', 'Staff have taken over this incident; request a correction')
      if (target.version !== input.expectedVersion)
        fail('CORRECTION_SOURCE_CHANGED', 'The incident changed')
      await this.apply(input.proposal)
      return this.state('discipline', input.proposal.targetId)
    })
  }

  async takeOverIncident(raw: z.input<typeof takeOverTeacherIncidentSchema>) {
    const input = takeOverTeacherIncidentSchema.parse(raw)
    return this.run('takeOverTeacherIncident', input, async () => {
      if (this.human().kind !== 'staff')
        denyResourceAccess()
      await this.base.access.teacherCorrections.assertTakeOverIncident(input.incidentId)
    }, async () => {
      const existing = await this.state('discipline', input.incidentId)
      return existing?.locked ? existing : this.remember('discipline', input.incidentId, 'taken_over', {}, true)
    })
  }

  async appendFollowUp(raw: z.input<typeof appendIncidentFollowUpSchema>) {
    const input = appendIncidentFollowUpSchema.parse(raw)
    return this.run('appendIncidentFollowUp', input, () => this.base.access.teacherCorrections.assertFollowUp(input.incidentId), async () => {
      const state = await this.state('discipline', input.incidentId)
      const followUp: TeacherWorkflowState = { schoolId: this.actor.schoolId, workflow: 'discipline', targetId: input.incidentId, version: state?.version ?? 0, locked: state?.locked ?? false, payload: state?.payload ?? {}, history: [...state?.history ?? [], { at: new Date().toISOString(), subjectId: this.human().subjectId, action: 'follow_up', payload: { text: input.text } }] }
      await this.repositories.teacherCorrections.saveState(followUp)
      return followUp
    })
  }

  private async callContext(anchor: z.infer<typeof attendanceCallSchema>['anchor']) {
    if (anchor.kind === 'lesson') {
      await this.base.access.teacherCorrections.assertLessonAttendance(anchor.lessonSessionId)
      const lesson = await this.repositories.lessonSessions.forSchool!(this.actor.schoolId).findById(anchor.lessonSessionId)
      if (!lesson)
        denyResourceAccess()
      return { key: `lesson:${lesson.id}`, classGroupId: lesson.classGroupId, startsAt: lesson.startsAt, endsAt: lesson.endsAt, lessonSessionId: lesson.id }
    }
    const date = new Date(anchor.date)
    date.setUTCHours(0, 0, 0, 0)
    const key = `daily:${anchor.classGroupId}:${date.toISOString().slice(0, 10)}`
    const endsAt = new Date(date.getTime() + 86400000)
    const existing = await this.repositories.attendances.forSchool!(this.actor.schoolId).findOne({ classGroupId: anchor.classGroupId, startsAt: date })
    const daily = existing ?? new Attendance({ id: key, schoolId: this.actor.schoolId, classGroupId: anchor.classGroupId, startsAt: date, endsAt, displayLabel: date.toISOString().slice(0, 10) })
    await this.base.access.entity('attendances').assertSave(daily, existing)
    return { key, classGroupId: anchor.classGroupId, startsAt: date, endsAt, attendanceId: daily.id, daily }
  }

  private async roster(classGroupId: string, at: Date) {
    return (await this.repositories.enrollments.list({ classGroupId })).filter(e => e.status === StudentClassEnrollmentStatus.Active && e.enrolledAt <= at && (!e.endedAt || e.endedAt >= at)).map(e => e.studentId)
  }

  async getAttendanceCall(input: { anchor: z.input<typeof attendanceCallSchema>['anchor'] }) {
    const anchor = attendanceCallSchema.shape.anchor.parse(input.anchor)
    const context = await this.callContext(anchor)
    const state = await this.state('attendance', context.key)
    const records = await this.repositories.attendance.list('lessonSessionId' in context ? { lessonSessionId: context.lessonSessionId } : { attendanceId: context.attendanceId })
    const submitted = state?.locked ?? records.length > 0
    const roster = submitted ? [...new Set(records.map(r => r.studentId))] : await this.roster(context.classGroupId, context.startsAt)
    const students = await this.repositories.students.findByIds(roster)
    const official = await Promise.all(records.map(async (record) => {
      const recordState = await this.state('attendance', record.id)
      const pending = (await this.repositories.teacherCorrections.forTarget(this.actor.schoolId, 'attendance', record.id)).find(c => c.status === 'pending' && c.authorSubjectId === this.human().subjectId)
      return { ...record.data, workflowVersion: recordState?.version ?? 0, pendingCorrection: pending, teacherExplanation: recordState?.payload['teacherExplanation'] ?? null }
    }))
    return { key: context.key, version: state?.version ?? 0, submitted, entries: submitted ? official.map(r => ({ studentId: r.studentId, status: r.status, notes: r.notes, teacherExplanation: r.teacherExplanation })) : state?.payload['entries'] ?? [], records: official, students: students.map(s => ({ id: s.id, firstName: s.firstName, lastName: s.lastName })) }
  }

  async attendanceCall(action: 'save' | 'submit', raw: z.input<typeof attendanceCallSchema>) {
    const input = attendanceCallSchema.parse(raw)
    return this.run(action === 'save' ? 'saveTeacherAttendanceDraft' : 'submitTeacherAttendance', input, () => this.callContext(input.anchor), async () => {
      const context = await this.callContext(input.anchor)
      const state = await this.state('attendance', context.key)
      const existing = await this.repositories.attendance.list('lessonSessionId' in context ? { lessonSessionId: context.lessonSessionId } : { attendanceId: context.attendanceId })
      if (state?.locked || existing.length)
        fail('CORRECTION_REQUIRED', 'Attendance has been submitted; request a correction or record an arrival')
      if ((state?.version ?? 0) !== input.expectedVersion)
        fail('ATTENDANCE_VERSION_CONFLICT', 'The attendance call changed; synchronize before submitting')
      const roster = await this.roster(context.classGroupId, context.startsAt)
      if (new Set(input.entries.map(e => e.studentId)).size !== input.entries.length)
        fail('DUPLICATE_ATTENDANCE', 'Each student may appear only once')
      if (input.entries.some(e => !roster.includes(e.studentId)))
        denyResourceAccess()
      const prior = (state?.payload['entries'] ?? []) as z.infer<typeof attendanceCallSchema>['entries']
      const entries = [...new Map([...prior, ...input.entries].map(e => [e.studentId, e])).values()].filter(e => roster.includes(e.studentId))
      if (action === 'submit') {
        if (!roster.length || roster.some(id => !entries.some(e => e.studentId === id)))
          fail('ATTENDANCE_INCOMPLETE', 'Record every student before finishing attendance')
        if ('daily' in context && context.daily)
          await this.repositories.attendances.save(context.daily)
        const records = entries.map(entry => new AttendanceRecord({ id: crypto.randomUUID(), studentId: entry.studentId, ...('lessonSessionId' in context ? { lessonSessionId: context.lessonSessionId } : { attendanceId: context.attendanceId }), date: context.startsAt, status: entry.status as AttendanceStatus, notes: entry.notes ?? undefined, createdBy: this.human().actorId }))
        await this.repositories.attendance.batchSave(records)
        for (const [index, record] of records.entries()) await this.remember('attendance', record.id, 'initial_submission', { original: record.data, teacherExplanation: entries[index]?.teacherExplanation ?? null }, true)
        await runWorkflowNotifications(this.base, ATTENDANCE_RECORDED_EVENT_KEY, { records, schoolId: this.actor.schoolId })
      }
      return this.remember('attendance', context.key, action === 'submit' ? 'submitted' : 'draft_saved', { entries, rosterStudentIds: roster }, action === 'submit')
    })
  }

  async recordArrival(raw: z.input<typeof attendanceArrivalSchema>) {
    const input = attendanceArrivalSchema.parse(raw)
    const proposal: CorrectionProposal = { workflow: 'attendance', targetId: input.recordId, status: 'late', notes: null, teacherExplanation: null }
    return this.run('recordTeacherAttendanceArrival', input, () => this.authorizeProposal(proposal), async () => {
      const record = await this.repositories.attendance.forSchool!(this.actor.schoolId).findById(input.recordId)
      if (!record)
        denyResourceAccess()
      const state = await this.state('attendance', record.id)
      if ((state?.version ?? 0) !== input.expectedVersion)
        fail('ATTENDANCE_VERSION_CONFLICT', 'The attendance record changed')
      const occurrence = record.lessonSessionId ? await this.repositories.lessonSessions.findById(record.lessonSessionId) : record.attendanceId ? await this.repositories.attendances.findById(record.attendanceId) : undefined
      const now = new Date()
      if (!occurrence || input.occurredAt < occurrence.startsAt || input.occurredAt > occurrence.endsAt || now > occurrence.endsAt || input.occurredAt > now)
        fail('ATTENDANCE_ARRIVAL_REVIEW_REQUIRED', 'This arrival is outside the active attendance window; request a correction')
      if (record.status !== AttendanceStatus.Absent)
        fail('ATTENDANCE_ARRIVAL_NOT_APPLICABLE', 'An arrival can be appended only to a recorded absence')
      const updated = new AttendanceRecord({ ...record.data, status: AttendanceStatus.Late, updatedAt: now })
      await this.repositories.attendance.save(updated)
      await runWorkflowNotifications(this.base, ATTENDANCE_RECORDED_EVENT_KEY, { records: [updated], schoolId: this.actor.schoolId, correction: true })
      return this.remember('attendance', record.id, 'arrival', { ...state?.payload, occurredAt: input.occurredAt.toISOString(), previous: record.data }, true)
    })
  }

  async getWorkflowState(input: { proposal: CorrectionProposal }) {
    const proposal = requestTeacherCorrectionSchema.shape.proposal.parse(input.proposal)
    await this.authorizeProposal(proposal)
    const target = await this.target(proposal)
    const state = await this.state(proposal.workflow, proposal.targetId)
    const requests = await this.repositories.teacherCorrections.forTarget(this.actor.schoolId, proposal.workflow, proposal.targetId)
    return { version: target.version, locked: target.locked, official: target.before, context: await this.labels({ classGroupId: target.classGroupId, authorSubjectId: this.human().subjectId, studentIds: target.studentIds }), history: state?.history ?? [], corrections: requests, consequences: target.consequences }
  }

  private async labels(row: { classGroupId: string, authorSubjectId: string, studentIds: string[] }) {
    const teacher = await this.repositories.teachers.forSchool!(this.actor.schoolId).findOne({ subjectId: row.authorSubjectId })
    const staff = teacher ? undefined : await this.repositories.staffMembers.forSchool!(this.actor.schoolId).findOne({ subjectId: row.authorSubjectId })
    const group = await this.repositories.classGroups.findById(row.classGroupId)
    const students = await this.repositories.students.findByIds(row.studentIds)
    const name = teacher ?? staff
    return { className: group?.name ?? '', teacherName: name ? `${name.firstName} ${name.lastName}` : '', students: students.map(s => ({ id: s.id, name: s.fullName })) }
  }

  async detail(input: { correctionId: string }) {
    const grade = await this.repositories.marksCorrections.find(this.actor.schoolId, input.correctionId)
    if (grade) {
      const review = await getAssessmentMarksReview(this.base, { assessmentId: grade.assessmentId })
      const row = review.corrections.find(c => c.id === grade.id)!
      return { context: await this.labels({ classGroupId: review.assessment.classGroupId, authorSubjectId: grade.authorSubjectId, studentIds: grade.changes.map(c => c.studentId) }), correction: { ...grade, workflow: 'grades' as const, targetId: grade.assessmentId, classGroupId: review.assessment.classGroupId, studentIds: grade.changes.map(c => c.studentId), periodId: review.assessment.periodId }, original: { assessment: review.assessment, students: review.students }, history: [], allowedActions: row.allowedActions }
    }
    const row = await this.require(input.correctionId)
    if (this.human().subjectId !== row.authorSubjectId) {
      if (this.actor.kind !== 'staff')
        denyResourceAccess()
      await this.base.access.teacherCorrections.assertReview(row.workflow, row.classGroupId, 'read')
    }
    else {
      await this.authorizeProposal(row.proposal)
    }
    const state = await this.state(row.workflow, `correction:${row.id}`)
    const history = await this.state(row.workflow, row.targetId)
    const fieldNames: Record<string, string> = {}
    if (row.proposal.workflow === 'logbook' && row.before.workflow === 'logbook') {
      for (const id of new Set([...row.proposal.progress, ...row.before.progress].map(p => p.matterId))) {
        const matter = await this.repositories.classSubjectMatters.findById(id)
        const subjectMatter = matter ? await this.repositories.subjectMatters.findById(matter.subjectMatterId) : undefined
        if (subjectMatter)
          fieldNames[id] = subjectMatter.name
      }
    }
    if (row.proposal.workflow === 'report_comments') {
      const result = await this.repositories.results.findById(row.targetId)
      const collect = (sections: readonly ReportCardResultSection[]) => {
        for (const section of sections) {
          fieldNames[section.sectionId] = section.name
          collect(section.subResults)
        }
      }
      if (result)
        collect(result.sectionResults)
    }
    const issuanceId = history?.payload['issuanceId']
    const issuance = typeof issuanceId === 'string' ? await this.repositories.documentIssuances.forSchool!(this.actor.schoolId).findById(issuanceId) : undefined
    let canReview = false
    if (this.actor.kind === 'staff' && this.actor.subjectId !== row.authorSubjectId) {
      try {
        await this.base.access.teacherCorrections.assertReview(row.workflow, row.classGroupId)
        canReview = true
      }
      catch (error) {
        if (!(error instanceof AuthorizationError))
          throw error
      }
    }
    return { context: await this.labels({ ...row, studentIds: [...new Set([...row.studentIds, ...(row.proposal.workflow === 'discipline' ? row.proposal.studentIds : [])])] }), correction: row, original: { ...state?.payload, fieldNames, ...(issuance ? { documentOutcome: { issuanceId: issuance.id, status: issuance.status, failureCode: issuance.failureCode } } : {}) }, history: history?.history ?? [], allowedActions: { approve: row.status === 'pending' && canReview, reject: row.status === 'pending' && canReview, withdraw: row.status === 'pending' && this.human().subjectId === row.authorSubjectId } }
  }

  async list(raw: z.input<typeof teacherCorrectionsQuerySchema>) {
    const input = teacherCorrectionsQuerySchema.parse(raw)
    if (this.human().kind !== 'staff')
      denyResourceAccess()
    const items: Array<TeacherCorrection | (MarksCorrection & { workflow: 'grades', targetId: string, classGroupId: string, periodId: string, studentIds: string[], title: string })> = []
    let total = 0
    for (const workflow of Object.keys(permissions) as CorrectionWorkflow[]) {
      if (input.workflow && input.workflow !== workflow)
        continue
      try {
        const scope = await this.base.access.teacherCorrections.queueScope(workflow)
        const page = await this.repositories.teacherCorrections.list(scope, { ...input, workflow, offset: 0, limit: input.offset + input.limit })
        items.push(...page.items)
        total += page.total
      }
      catch (error) {
        if (!(error instanceof AuthorizationError))
          throw error
      }
    }
    if (!input.workflow || input.workflow === 'grades') {
      try {
        const scope = await this.base.access.marksReview.queueScope()
        const page = await this.repositories.marksCorrections.list(scope, { ...input, offset: 0, limit: input.offset + input.limit })
        const sheets = new Map((await this.repositories.assessments.forAccess(scope).findByIds(page.items.map(c => c.assessmentId))).map(s => [s.id, s]))
        for (const row of page.items) {
          const sheet = sheets.get(row.assessmentId)
          if (!sheet)
            denyResourceAccess()
          items.push({ ...row, workflow: 'grades', targetId: sheet.id, classGroupId: sheet.classGroupId, periodId: sheet.periodId, studentIds: row.changes.map(c => c.studentId), title: sheet.title })
        }
        total += page.total
      }
      catch (error) {
        if (!(error instanceof AuthorizationError))
          throw error
      }
    }
    items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
    const page = []
    for (const row of items.slice(input.offset, input.offset + input.limit)) {
      const teacher = await this.repositories.teachers.forSchool!(this.actor.schoolId).findOne({ subjectId: row.authorSubjectId })
      const staff = teacher ? undefined : await this.repositories.staffMembers.forSchool!(this.actor.schoolId).findOne({ subjectId: row.authorSubjectId })
      const group = await this.repositories.classGroups.findById(row.classGroupId)
      const students = await this.repositories.students.findByIds(row.studentIds)
      const name = teacher ?? staff
      page.push({ ...row, title: 'title' in row ? row.title : row.workflow === 'discipline' && row.before.workflow === 'discipline' ? row.before.title : group?.name ?? '', className: group?.name ?? '', teacherName: name ? `${name.firstName} ${name.lastName}` : '', students: students.map(s => ({ id: s.id, name: s.fullName })) })
    }
    const facetRows: Array<{ classGroupId: string, authorSubjectId: string, studentIds: string[] }> = []
    for (const workflow of Object.keys(permissions) as CorrectionWorkflow[]) {
      if (input.workflow && input.workflow !== workflow)
        continue
      try {
        const scope = await this.base.access.teacherCorrections.queueScope(workflow)
        for (const status of ['pending', 'approved', 'rejected', 'withdrawn'] as const) {
          const rows = await this.repositories.teacherCorrections.list(scope, { workflow, status, offset: 0, limit: Number.MAX_SAFE_INTEGER })
          facetRows.push(...rows.items)
        }
      }
      catch (error) {
        if (!(error instanceof AuthorizationError))
          throw error
      }
    }
    if (!input.workflow || input.workflow === 'grades') {
      try {
        const scope = await this.base.access.marksReview.queueScope()
        for (const status of ['pending', 'approved', 'rejected', 'withdrawn'] as const) {
          const rows = await this.repositories.marksCorrections.list(scope, { status, offset: 0, limit: Number.MAX_SAFE_INTEGER })
          const sheets = await this.repositories.assessments.forAccess(scope).findByIds(rows.items.map(r => r.assessmentId))
          for (const row of rows.items) {
            const sheet = sheets.find(s => s.id === row.assessmentId)
            if (sheet)
              facetRows.push({ classGroupId: sheet.classGroupId, authorSubjectId: row.authorSubjectId, studentIds: row.changes.map(c => c.studentId) })
          }
        }
      }
      catch (error) {
        if (!(error instanceof AuthorizationError))
          throw error
      }
    }
    const classes = new Map<string, string>()
    const teachers = new Map<string, string>()
    const students = new Map<string, string>()
    for (const row of facetRows) {
      const labels = await this.labels(row)
      classes.set(row.classGroupId, labels.className)
      teachers.set(row.authorSubjectId, labels.teacherName)
      for (const student of labels.students) students.set(student.id, student.name)
    }
    const options = (values: Map<string, string>) => [...values].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
    return { items: page, total, offset: input.offset, limit: input.limit, filters: { classes: options(classes), teachers: options(teachers), students: options(students) } }
  }
}
