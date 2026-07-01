import { describe, expect, it } from 'bun:test'
import { IncidentInvolvementRole, StudentIncidentInvolvement } from '../../../../src/domains/students/student-incident-involvement'

describe('StudentIncidentInvolvement entity roles and validation', () => {
  const baseArgs = {
    id: 'involvement-1',
    incidentId: 'incident-1',
    studentId: 'student-1',
    role: IncidentInvolvementRole.Subject,
  }

  it('instantiates successfully with valid inputs and defaults', () => {
    const involvement = new StudentIncidentInvolvement(baseArgs)

    expect(involvement.id).toBe('involvement-1')
    expect(involvement.incidentId).toBe('incident-1')
    expect(involvement.studentId).toBe('student-1')
    expect(involvement.role).toBe(IncidentInvolvementRole.Subject)
    expect(involvement.createdAt).toBeInstanceOf(Date)
    expect(involvement.notes).toBeUndefined()
  })

  it('handles optional parameters correctly', () => {
    const createdDate = new Date()
    const involvement = new StudentIncidentInvolvement({
      ...baseArgs,
      notes: 'Observed standard warning procedure',
      createdAt: createdDate,
    })

    expect(involvement.notes).toBe('Observed standard warning procedure')
    expect(involvement.createdAt.getTime()).toBe(createdDate.getTime())
  })

  it('throws error when non-blank fields are empty or invalid', () => {
    expect(() => new StudentIncidentInvolvement({ ...baseArgs, id: '' })).toThrow()
    expect(() => new StudentIncidentInvolvement({ ...baseArgs, incidentId: ' ' })).toThrow()
    expect(() => new StudentIncidentInvolvement({ ...baseArgs, studentId: '\t' })).toThrow()
  })

  it('throws error when optional notes is empty string', () => {
    expect(() => new StudentIncidentInvolvement({ ...baseArgs, notes: '   ' })).toThrow()
  })
})
