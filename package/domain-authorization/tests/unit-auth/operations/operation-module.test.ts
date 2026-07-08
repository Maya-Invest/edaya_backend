import { AuthorizationError, GradeOperations, operationModule } from '@edaya/authorization'
import { describe, expect, test } from 'bun:test'
import { AuthFixtures } from '../../support/authorization-fixtures'

describe('operationModule context matching', () => {
  test('grades.input rejects teachers on wrong classSubject', () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    expect(() => operationModule(GradeOperations.input, { classSubjectId: 'cs-math' })(actor)).not.toThrow()
    expect(() => operationModule(GradeOperations.input, { classSubjectId: 'cs-other' })(actor)).toThrow(AuthorizationError)
  })

  test('teacher anyOf allows homeroom fallback for grade read', () => {
    const actor = AuthFixtures.teacher.homeroom('cg-7a')
    expect(() => operationModule(GradeOperations.read, { classGroupId: 'cg-7a' })(actor)).not.toThrow()
  })
})
