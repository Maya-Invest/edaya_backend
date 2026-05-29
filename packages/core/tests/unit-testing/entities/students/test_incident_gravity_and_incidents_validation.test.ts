import { describe, expect, it } from 'bun:test'
import { Incident, IncidentKind, IncidentStatus } from '../../../../src/entities/students/incident'

describe('Incident entity gravity and status validation', () => {
  const baseArgs = {
    id: 'incident-1',
    schoolId: 'school-1',
    title: 'Disruptive Behavior',
    description: 'Student disrupted the classroom activities',
    date: new Date(),
    kind: IncidentKind.MinorInfraction,
    reporterId: 'teacher-1',
  }

  it('instantiates successfully for an open incident with valid inputs', () => {
    const incident = new Incident(baseArgs)

    expect(incident.id).toBe('incident-1')
    expect(incident.schoolId).toBe('school-1')
    expect(incident.title).toBe('Disruptive Behavior')
    expect(incident.description).toBe('Student disrupted the classroom activities')
    expect(incident.kind).toBe(IncidentKind.MinorInfraction)
    expect(incident.reporterId).toBe('teacher-1')
    expect(incident.status).toBe(IncidentStatus.Open)
    expect(incident.createdAt).toBeInstanceOf(Date)
    expect(incident.updatedAt).toBeInstanceOf(Date)
  })

  it('handles optional parameters correctly', () => {
    const createdDate = new Date('2026-09-01T08:00:00Z')
    const updatedDate = new Date('2026-09-01T09:00:00Z')
    const incident = new Incident({
      ...baseArgs,
      classGroupId: 'class-1',
      sessionId: 'session-1',
      createdAt: createdDate,
      updatedAt: updatedDate,
    })

    expect(incident.classGroupId).toBe('class-1')
    expect(incident.sessionId).toBe('session-1')
    expect(incident.createdAt.getTime()).toBe(createdDate.getTime())
    expect(incident.updatedAt.getTime()).toBe(updatedDate.getTime())
  })

  it('throws error when non-blank fields are empty or invalid', () => {
    expect(() => new Incident({ ...baseArgs, id: '' })).toThrow()
    expect(() => new Incident({ ...baseArgs, schoolId: ' ' })).toThrow()
    expect(() => new Incident({ ...baseArgs, title: '\t' })).toThrow()
    expect(() => new Incident({ ...baseArgs, description: ' \n ' })).toThrow()
    expect(() => new Incident({ ...baseArgs, reporterId: '   ' })).toThrow()
  })

  it('throws error if resolvedAt is defined without resolvedByStaffId, or vice versa', () => {
    expect(() => new Incident({
      ...baseArgs,
      status: IncidentStatus.Resolved,
      resolvedAt: new Date(),
    })).toThrow('resolvedAt and resolvedByStaffId must be provided together')

    expect(() => new Incident({
      ...baseArgs,
      status: IncidentStatus.Resolved,
      resolvedByStaffId: 'admin-1',
    })).toThrow('resolvedAt and resolvedByStaffId must be provided together')
  })

  it('throws error if status is Resolved but resolvedAt is missing', () => {
    expect(() => new Incident({
      ...baseArgs,
      status: IncidentStatus.Resolved,
      resolvedByStaffId: 'admin-1',
    })).toThrow()
  })

  it('instantiates successfully for a resolved incident when all audit fields are supplied', () => {
    const resolvedDate = new Date()
    const incident = new Incident({
      ...baseArgs,
      status: IncidentStatus.Resolved,
      resolutionNotes: 'Meeting held with student',
      resolvedAt: resolvedDate,
      resolvedByStaffId: 'admin-1',
    })

    expect(incident.status).toBe(IncidentStatus.Resolved)
    expect(incident.resolvedAt?.getTime()).toBe(resolvedDate.getTime())
    expect(incident.resolvedByStaffId).toBe('admin-1')
    expect(incident.resolutionNotes).toBe('Meeting held with student')
  })

  it('throws error if open incident defines resolution fields', () => {
    expect(() => new Incident({
      ...baseArgs,
      status: IncidentStatus.Open,
      resolvedAt: new Date(),
      resolvedByStaffId: 'admin-1',
    })).toThrow('open incidents must not define resolution fields')

    expect(() => new Incident({
      ...baseArgs,
      status: IncidentStatus.Open,
      resolutionNotes: 'Resolved amicably',
    })).toThrow('open incidents must not define resolution fields')
  })

  it('throws error if updatedAt is before createdAt', () => {
    const createdDate = new Date('2026-09-02T00:00:00Z')
    const updatedDate = new Date('2026-09-01T00:00:00Z')

    expect(() => new Incident({
      ...baseArgs,
      createdAt: createdDate,
      updatedAt: updatedDate,
    })).toThrow('updatedAt must not be before createdAt')
  })
})
