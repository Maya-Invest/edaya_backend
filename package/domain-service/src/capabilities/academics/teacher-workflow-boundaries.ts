import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { CoreEntityKey, CoreEntityMap } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { BusinessRuleViolationError } from '@edaya/core'

/** Shared by single, batch and delete paths. Named commands own lifecycle transitions. */
export async function assertTeacherWorkflowWrite(actor: SchoolScopedActorMetadata, resource: CoreEntityKey, value: unknown, existing: unknown, repositories: SchoolRepositories) {
  if (actor.kind !== 'teacher')
    return
  if (resource === 'incidents' && existing) {
    const incident = existing as CoreEntityMap['incidents']
    const state = await repositories.teacherCorrections.state(actor.schoolId, 'discipline', incident.id)
    if (incident.reporterId !== actor.teacherId || incident.status !== 'open' || state?.locked || await repositories.studentDisciplinaryActions.count({ incidentId: incident.id }))
      throw new BusinessRuleViolationError('CORRECTION_REQUIRED', 'Staff have taken over this incident; request a correction')
  }
  if (resource === 'classSubjectProgress' && existing) {
    const prior = existing as CoreEntityMap['classSubjectProgress']
    const state = await repositories.teacherCorrections.state(actor.schoolId, 'logbook', prior.lessonSessionId)
    if (state?.locked)
      throw new BusinessRuleViolationError('CORRECTION_REQUIRED', 'This logbook has been validated; request a correction')
  }
  if (resource === 'studentIncidentInvolvements') {
    const involvement = value as CoreEntityMap['studentIncidentInvolvements']
    const incident = await repositories.incidents.forSchool!(actor.schoolId).findById(involvement.incidentId)
    const state = await repositories.teacherCorrections.state(actor.schoolId, 'discipline', involvement.incidentId)
    if (incident?.reporterId !== actor.teacherId || incident?.status !== 'open' || state?.locked || await repositories.studentDisciplinaryActions.count({ incidentId: involvement.incidentId }))
      throw new BusinessRuleViolationError('CORRECTION_REQUIRED', 'Staff have taken over this incident; request a correction')
  }
  if (resource === 'attendance')
    throw new BusinessRuleViolationError('ATTENDANCE_CALL_COMMAND_REQUIRED', 'Save the attendance draft and finish the complete call before making records official')
  const row = value as { id: string, lessonSessionId?: string, sessionNote?: string }
  const previous = existing as CoreEntityMap['lessonSessions'] | undefined
  const lessonId = resource === 'lessonSessions' ? row.id : resource === 'classSubjectProgress' ? row.lessonSessionId : undefined
  if (lessonId && (resource !== 'lessonSessions' || !previous || row.sessionNote !== previous.sessionNote)) {
    const state = await repositories.teacherCorrections.state(actor.schoolId, 'logbook', lessonId)
    if (state?.locked)
      throw new BusinessRuleViolationError('CORRECTION_REQUIRED', 'This logbook has been validated; request a correction')
  }
}

/** Reading does not take over an incident. A formal staff decision does. */
export async function recordTeacherWorkflowDecision(actor: SchoolScopedActorMetadata, resource: CoreEntityKey, value: unknown, previous: unknown, repositories: SchoolRepositories) {
  if (actor.kind !== 'staff')
    return
  const incident = resource === 'incidents' ? value as CoreEntityMap['incidents'] : undefined
  const before = previous as CoreEntityMap['incidents'] | undefined
  const action = resource === 'studentDisciplinaryActions' ? value as CoreEntityMap['studentDisciplinaryActions'] : undefined
  const formal = action !== undefined || (incident && (incident.status !== (before?.status ?? 'open') || incident.resolutionNotes !== before?.resolutionNotes))
  const incidentId = incident?.id ?? action?.incidentId
  if (!formal || !incidentId)
    return
  const state = await repositories.teacherCorrections.state(actor.schoolId, 'discipline', incidentId)
  const payload = { ...state?.payload, outcomesNeedReview: false }
  await repositories.teacherCorrections.saveState({ schoolId: actor.schoolId, workflow: 'discipline', targetId: incidentId, version: (state?.version ?? 0) + 1, locked: true, payload, history: [...state?.history ?? [], { at: new Date().toISOString(), subjectId: actor.subjectId, action: 'staff_decision', payload: { previous: previous && typeof previous === 'object' && 'data' in previous ? previous.data : null, decision: incident?.data ?? action?.data } }] })
}
