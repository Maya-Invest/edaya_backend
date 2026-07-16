import type { GuardianActorMetadata, StudentActorMetadata } from '@edaya/authorization'
import {
  assertCapability,
  AuthorizationError,
  GuardianCapability,
  HomeroomCapability,
  StudentCapability,
  TeachingCapability,
} from '@edaya/authorization'
import { describe, expect, test } from 'bun:test'
import {
  capabilityTargetFromAuthorizationScope,
  homeroomTargetFromAuthorizationScope,
  teachingTargetFromAuthorizationScope,
} from '../../src/capabilities/assert-capability'
import { AuthFixtures } from '../support/authorization-fixtures'

describe('assertCapability', () => {
  test('rejects staff actors in favor of authorize(Permission)', () => {
    const actor = AuthFixtures.staff.withPermissions([])
    expect(() => assertCapability(actor as never, GuardianCapability.ReadSelfProfile)).toThrow(AuthorizationError)
    expect(() => assertCapability(actor as never, GuardianCapability.ReadSelfProfile)).toThrow(/authorize\(Permission\)/)
  })

  test('routes teacher teaching capabilities to teaching gate', () => {
    const actor = AuthFixtures.teacher.subject('cs-math', ['cg-7a'])
    expect(() => assertCapability(
      actor,
      TeachingCapability.InputGrade,
      { classSubjectId: 'cs-math' },
    )).not.toThrow()
  })

  test('routes teacher homeroom capabilities to homeroom gate', () => {
    const actor = AuthFixtures.teacher.homeroom('cg-7a')
    expect(() => assertCapability(
      actor,
      HomeroomCapability.RecordDailyAttendance,
      { classGroupId: 'cg-7a' },
    )).not.toThrow()
  })

  test('rejects unknown teacher capabilities', () => {
    const actor = AuthFixtures.teacher.homeroom('cg-7a')
    expect(() => assertCapability(actor, GuardianCapability.ReadSelfProfile)).toThrow(AuthorizationError)
  })

  test('routes guardian capabilities through guardian gate', () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    expect(() => assertCapability(
      actor as GuardianActorMetadata,
      GuardianCapability.ReadStudentDetail,
      { studentId: 'student-1' },
    )).not.toThrow()
  })

  test('routes student capabilities through student gate', () => {
    const actor = AuthFixtures.student.enrolledIn('class-1', 'student-1')
    expect(() => assertCapability(
      actor as StudentActorMetadata,
      StudentCapability.ReadGrades,
      { studentId: 'student-1' },
    )).not.toThrow()
  })
})

describe('capability target scope helpers', () => {
  test('capabilityTargetFromAuthorizationScope maps student and class group scopes', () => {
    expect(capabilityTargetFromAuthorizationScope({
      scopeType: 'student',
      scopeEntityId: 'student-1',
    })).toEqual({ studentId: 'student-1' })

    expect(capabilityTargetFromAuthorizationScope({
      scopeType: 'class_group',
      scopeEntityId: 'class-1',
    })).toEqual({ classGroupId: 'class-1' })

    expect(capabilityTargetFromAuthorizationScope(undefined)).toBeUndefined()
  })

  test('teachingTargetFromAuthorizationScope extracts class subject id', () => {
    expect(teachingTargetFromAuthorizationScope({
      scopeType: 'class_subject',
      scopeEntityId: 'cg-1:cs-1',
    })).toEqual({ classSubjectId: 'cs-1' })

    expect(teachingTargetFromAuthorizationScope({
      scopeType: 'class_group',
      scopeEntityId: 'cg-1',
    })).toBeUndefined()
  })

  test('homeroomTargetFromAuthorizationScope maps class group paths', () => {
    expect(homeroomTargetFromAuthorizationScope({
      scopeType: 'class_group',
      scopeEntityId: 'cg-1',
    })).toEqual({ classGroupId: 'cg-1' })

    expect(homeroomTargetFromAuthorizationScope({
      scopeType: 'class_subject',
      scopeEntityId: 'cg-1:cs-1',
    })).toEqual({ classGroupId: 'cg-1' })
  })
})
