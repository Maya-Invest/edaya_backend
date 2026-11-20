import type { TeacherIncidentDetailInput, TeacherIncidentsInput } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import type { TeacherCorrectionsWorkflow } from '../workflows/teacher-corrections'
import { denyResourceAccess } from '@edaya/authorization'
import { DomainValidationError, teacherIncidentsPageSize } from '@edaya/core'
import { z } from 'zod'
import { scopedIdCursor } from './scoped-id-cursor'

const boundary = z.tuple([z.string().datetime(), z.string().min(1)])
export function getTeacherIncidents(base: BaseSchoolService, input: TeacherIncidentsInput) {
  return base.atomicExecution.execute(async () => {
    const { read, edit, actor } = await base.access.forOperation().discipline.authoredIncidentScopes(input.classGroupId)
    const cursor = await scopedIdCursor([actor.subjectId, actor.teacherId, actor.schoolId, actor.academicYearId, input.classGroupId, read, edit], input.cursor, 'Invalid incident cursor')
    let after
    if (cursor.after) {
      try {
        const [date, id] = boundary.parse(JSON.parse(cursor.after))
        after = { date, id }
      }
      catch { throw new DomainValidationError('Invalid incident cursor') }
    }
    const rows = await base.repositories.teacherIncidents.list({ read, edit, teacherId: actor.teacherId, classGroupId: input.classGroupId, after })
    const items = rows.slice(0, teacherIncidentsPageSize)
    const last = items.at(-1)
    return { items, nextCursor: last && rows.length > items.length ? cursor.encode(JSON.stringify([last.date, last.id])) : null }
  }, { readSnapshot: true })
}

export function getTeacherIncidentDetail(base: BaseSchoolService, workflow: TeacherCorrectionsWorkflow, input: TeacherIncidentDetailInput) {
  return base.atomicExecution.execute(async () => {
    const actor = base.actor
    if (actor.kind !== 'teacher')
      denyResourceAccess()
    const incident = await base.entities.incidents.findById(input.incidentId, base.access.forOperation())
    if (!incident || incident.reporterId !== actor.teacherId || incident.classGroupId !== input.classGroupId)
      denyResourceAccess()
    const { id, title, description, kind, status, date } = incident
    const eligibility = await workflow.getWorkflowState({ proposal: { workflow: 'discipline', targetId: id, title, description, kind, studentIds: [] } })
    return { incident: { id, title, description, kind, status, date: date.toISOString(), locked: eligibility.locked }, eligibility }
  }, { readSnapshot: true })
}
