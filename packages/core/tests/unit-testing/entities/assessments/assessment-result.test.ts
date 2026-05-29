import { describe, expect, test } from 'bun:test'
import { AssessmentResult, DeadlineComplianceStatus } from '../../../../src/entities/assessments/assessment-result'

describe('AssessmentResult entity', () => {
  test('instantiates successfully with valid inputs', () => {
    const result = new AssessmentResult({
      id: 'res1',
      studentId: 'stu1',
      assessmentId: 'ass1',
      score: 18.555, // Should round to 18.56
      status: DeadlineComplianceStatus.Late,
      notes: 'Submitted late',
      createdBy: 'staff1',
    })

    expect(result.id).toBe('res1')
    expect(result.studentId).toBe('stu1')
    expect(result.assessmentId).toBe('ass1')
    expect(result.score).toBe(18.56)
    expect(result.status).toBe(DeadlineComplianceStatus.Late)
    expect(result.notes).toBe('Submitted late')
    expect(result.createdBy).toBe('staff1')
    expect(result.createdAt).toBeInstanceOf(Date)
  })

  test('handles undefined/null score and status correctly', () => {
    const result = new AssessmentResult({
      id: 'res1',
      studentId: 'stu1',
      assessmentId: 'ass1',
    })

    expect(result.score).toBeUndefined()
    expect(result.status).toBeUndefined()
    expect(result.notes).toBeUndefined()
    expect(result.createdBy).toBeUndefined()
  })

  test('throws DomainValidationError if score is negative', () => {
    expect(() => {
      new AssessmentResult({
        id: 'res1',
        studentId: 'stu1',
        assessmentId: 'ass1',
        score: -5,
      })
    }).toThrow('score must be a finite, non-negative number')
  })
})
