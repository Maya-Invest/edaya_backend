import type { ManagedEntityServiceConfig } from '../../../../src/application/entities/managed-entity-service'
import type { AuthCacheInvalidationEvent } from '../../../../src/capabilities/authorization/lifecycle/types'
import type { StudentClassEnrollment } from '../../../../src/domain/students/student-class-enrollment'
import { describe, expect, test } from 'bun:test'
import { config, noopReadAccess, read, write } from '../../../../src/application/entities/entity-config'
import { createSystemActorMetadata } from '../../../../src/capabilities/authorization'
import { withAuthCacheLifecycleHooks } from '../../../../src/capabilities/authorization/lifecycle/auth-cache-hooks'
import { resolveAuthCacheInvalidationEvents } from '../../../../src/capabilities/authorization/lifecycle/entity-events'
import { invalidateAuthCacheForEvents } from '../../../../src/capabilities/authorization/lifecycle/invalidation-registry'

describe('resolveAuthCacheInvalidationEvents', () => {
  test('staff permission assignment emits staff-grants', () => {
    expect(resolveAuthCacheInvalidationEvents('staffPermissionAssignments', {
      staffId: 'staff-1',
      schoolId: 'school-1',
    })).toEqual([{
      kind: 'staff-grants',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
    }])
  })

  test('guardian link emits guardian and student scope events', () => {
    expect(resolveAuthCacheInvalidationEvents('guardianLinks', {
      guardianId: 'guardian-1',
      studentId: 'student-1',
      schoolId: 'school-1',
    })).toEqual([
      { kind: 'guardian-scope', guardianId: 'guardian-1', schoolId: 'school-1' },
      { kind: 'student-scope', studentId: 'student-1', schoolId: 'school-1' },
    ])
  })

  test('enrollment emits student scope from studentId', () => {
    expect(resolveAuthCacheInvalidationEvents('enrollments', {
      studentId: 'student-1',
    })).toEqual([{
      kind: 'student-scope',
      studentId: 'student-1',
      schoolId: undefined,
    }])
  })

  test('teacher assignment emits teacher scope from teacherId', () => {
    expect(resolveAuthCacheInvalidationEvents('teacherAssignments', {
      teacherId: 'teacher-1',
    })).toEqual([{
      kind: 'teacher-scope',
      teacherId: 'teacher-1',
      schoolId: undefined,
    }])
  })

  test('staff member and assignment entities emit staff grant events', () => {
    expect(resolveAuthCacheInvalidationEvents('staffMembers', {
      id: 'staff-1',
      schoolId: 'school-1',
    })).toEqual([{ kind: 'staff-grants', staffMemberId: 'staff-1', schoolId: 'school-1' }])

    expect(resolveAuthCacheInvalidationEvents('staffAssignments', {
      staffId: 'staff-1',
      schoolId: 'school-1',
    })).toEqual([{ kind: 'staff-grants', staffMemberId: 'staff-1', schoolId: 'school-1' }])
  })

  test('portal actor entities emit scope invalidation events', () => {
    expect(resolveAuthCacheInvalidationEvents('students', { id: 'student-1', schoolId: 'school-1' }))
      .toEqual([{ kind: 'student-scope', studentId: 'student-1', schoolId: 'school-1' }])
    expect(resolveAuthCacheInvalidationEvents('guardians', { id: 'guardian-1', schoolId: 'school-1' }))
      .toEqual([{ kind: 'guardian-scope', guardianId: 'guardian-1', schoolId: 'school-1' }])
    expect(resolveAuthCacheInvalidationEvents('teachers', { id: 'teacher-1', schoolId: 'school-1' }))
      .toEqual([{ kind: 'teacher-scope', teacherId: 'teacher-1', schoolId: 'school-1' }])
  })

  test('ignores invalid entities and unrelated entity keys', () => {
    expect(resolveAuthCacheInvalidationEvents('staffPermissionAssignments', null)).toEqual([])
    expect(resolveAuthCacheInvalidationEvents('schools', { id: 'school-1' })).toEqual([])
  })
})

describe('invalidateAuthCacheForEvents', () => {
  test('forwards each event to the port', () => {
    const received: AuthCacheInvalidationEvent[] = []
    invalidateAuthCacheForEvents([
      { kind: 'student-scope', studentId: 'student-1', schoolId: 'school-1' },
      { kind: 'guardian-scope', guardianId: 'guardian-1', schoolId: 'school-1' },
    ], {
      invalidateForEvent: event => received.push(event),
    })

    expect(received).toHaveLength(2)
  })
})

describe('withAuthCacheLifecycleHooks', () => {
  test('chains postSave invalidation after existing hooks', async () => {
    const received: AuthCacheInvalidationEvent[] = []
    const port = { invalidateForEvent: (event: AuthCacheInvalidationEvent) => received.push(event) }
    let existingHookRan = false

    const baseConfig = config({
      repository: {
        findById: async () => undefined,
        findByIds: async () => [],
        findOne: async () => undefined,
        list: async () => [],
        count: async () => 0,
        save: async () => {},
        batchSave: async () => [],
        delete: async () => {},
        batchDelete: async () => {},
      },
      tenant: { resolve: () => 'school-1' },
      read: read(async () => {}, noopReadAccess),
      write: write(async () => {}, async () => {}, async () => {}),
      hooks: {
        postSave: async () => {
          existingHookRan = true
        },
      },
    })

    const wrapped = withAuthCacheLifecycleHooks(
      'enrollments',
      baseConfig as unknown as ManagedEntityServiceConfig<StudentClassEnrollment>,
      port,
    )
    const actor = createSystemActorMetadata({
      schoolId: 'school-1',
      systemId: 'test',
      requestId: 'req-1',
      reason: 'unit-test',
    })

    await wrapped.hooks?.postSave?.(
      { studentId: 'student-1' } as unknown as StudentClassEnrollment,
      undefined,
      {} as never,
      actor,
    )

    expect(existingHookRan).toBe(true)
    expect(received).toEqual([{ kind: 'student-scope', studentId: 'student-1', schoolId: undefined }])
  })
})
