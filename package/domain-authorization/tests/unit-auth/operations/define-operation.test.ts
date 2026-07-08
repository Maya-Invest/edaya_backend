import type { StudentCapability } from '../../../src/capabilities/student-capability'
import { describe, expect, test } from 'bun:test'
import { GuardianCapability } from '../../../src/capabilities/guardian-capability'
import { TeachingCapability } from '../../../src/capabilities/teaching-capability'
import {
  defineOperation,
  defineOperationFamily,
  resetOperationRegistryForTests,
} from '../../../src/operations/define-operation'
import { Permission } from '../../../src/permissions/permission'

describe('defineOperation', () => {
  test('rejects operations without actor paths', () => {
    resetOperationRegistryForTests()
    expect(() => defineOperation({ id: 'test.empty' })).toThrow(/at least one actor path/)
  })

  test('rejects guardian-only capability on student rule', () => {
    resetOperationRegistryForTests()
    expect(() => defineOperation({
      id: 'test.bad-student',
      student: { capability: GuardianCapability.ReadSelfProfile as unknown as StudentCapability },
    })).toThrow(/StudentCapability/)
  })

  test('requires requiresContext to cover declared teacher targets', () => {
    resetOperationRegistryForTests()
    expect(() => defineOperation({
      id: 'grades.input',
      requiresContext: ['studentId'],
      teacher: { capability: TeachingCapability.InputGrade, target: 'classSubject' },
    })).toThrow(/requiresContext must include classSubjectId/)
  })

  test('registers operation families', () => {
    resetOperationRegistryForTests()
    const ops = defineOperationFamily({
      read: {
        id: 'demo.read',
        staff: { permission: Permission.GRADE_READ },
      },
    })
    expect(ops.read.id).toBe('demo.read')
  })
})
