import { describe, expect, it } from 'bun:test'
import {
  DisciplinaryActionKind,
  IncidentInvolvementRole,
  IncidentKind,
  IncidentStatus,
  SessionKind,
  StudentDisciplinaryActionStatus,
} from '../../../src/entities'
import { createTestApp } from '../../support/in-memory-school-headless-app'

describe('behavior and discipline journey', () => {
  it('records incidents, links students, applies actions, resolves, and projects detail', async () => {
    const { app } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School', timeZone: 'UTC' })
    await app.setup.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
    await app.setup.createClassGroup({
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await app.students.registerStudent({ id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
    await app.students.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
    const session = await app.scheduling.createSession({
      id: 'session',
      schoolId: 'school',
      classGroupId: 'class',
      title: 'Advisory',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-10T08:00:00Z'),
      endsAt: new Date('2026-09-10T09:00:00Z'),
    })
    const catalogAction = await app.behavior.createDisciplinaryAction({
      id: 'warning',
      schoolId: 'school',
      name: 'Written warning',
      kind: DisciplinaryActionKind.Sanction,
      severity: 1,
      defaultDurationDays: 1,
    })
    const incident = await app.behavior.recordIncident({
      id: 'incident',
      schoolId: 'school',
      classGroupId: 'class',
      sessionId: session.id,
      title: 'Class disruption',
      description: 'Repeated interruption during class.',
      date: new Date('2026-09-10T08:30:00Z'),
      kind: IncidentKind.MinorInfraction,
    })
    const involvement = await app.behavior.addStudentInvolvement({
      id: 'involvement',
      incidentId: incident.id,
      studentId: 'student',
      role: IncidentInvolvementRole.Subject,
      notes: 'Discussed with student.',
    })
    await expect(app.behavior.addStudentInvolvement({
      id: 'duplicate',
      incidentId: incident.id,
      studentId: 'student',
      role: IncidentInvolvementRole.Witness,
    })).rejects.toThrow('already linked')
    const applied = await app.behavior.applyDisciplinaryAction({
      id: 'applied-warning',
      incidentId: incident.id,
      studentId: 'student',
      disciplinaryActionId: catalogAction.id,
      startsAt: new Date('2026-09-10T00:00:00Z'),
      endsAt: new Date('2026-09-11T00:00:00Z'),
      notes: 'Guardian notified.',
    })
    const completed = await app.behavior.updateStudentDisciplinaryActionStatus({
      studentDisciplinaryActionId: applied.id,
      status: StudentDisciplinaryActionStatus.Completed,
      updatedAt: new Date('2026-09-12T00:00:00Z'),
    })
    const resolved = await app.behavior.resolveIncident({
      incidentId: incident.id,
      resolutionNotes: 'Action completed.',
      resolvedAt: new Date('2026-09-12T12:00:00Z'),
    })

    expect(involvement.role).toBe(IncidentInvolvementRole.Subject)
    expect(completed.status).toBe(StudentDisciplinaryActionStatus.Completed)
    expect(resolved.status).toBe(IncidentStatus.Resolved)
    expect(resolved.resolvedByStaffId).toBe('admin')

    const detail = await app.queries.getIncidentDetail({ schoolId: 'school', incidentId: incident.id })
    expect(detail.incident.status).toBe(IncidentStatus.Resolved)
    expect(detail.session?.id).toBe(session.id)
    expect(detail.involvements[0]?.student.id).toBe('student')
    expect(detail.involvements[0]?.actions[0]?.disciplinaryAction.id).toBe('warning')
    expect(detail.involvements[0]?.actions[0]?.studentDisciplinaryAction.status)
      .toBe(StudentDisciplinaryActionStatus.Completed)

    const studentIncidents = await app.queries.listStudentIncidents({ schoolId: 'school', studentId: 'student' })
    expect(studentIncidents.rows.map(row => row.incident.id)).toEqual(['incident'])
    expect(studentIncidents.rows[0]?.actions).toHaveLength(1)
  })
})
