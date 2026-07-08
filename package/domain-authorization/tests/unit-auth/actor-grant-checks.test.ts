import {
  ActorAssuranceLevel,
  actorGrantCoversAny,
  actorGrantCoversAnyResourcePath,
  actorGrantCoversResourcePath,
  actorHasAnyPermission,
  actorHasSchoolWideGrant,
  createStaffActorMetadata,
  createSystemActorMetadata,
  Permission,
} from '@edaya/authorization'
import { describe, expect, test } from 'bun:test'

const now = new Date('2026-09-01T00:00:00Z')

function scopedStaff(permission: Permission, scopeIds: string) {
  return createStaffActorMetadata({
    subjectId: 'subject-staff',
    staffMemberId: 'staff-1',
    schoolId: 'school-1',
    requestId: 'test',
    authenticatedAt: now,
    assuranceLevel: ActorAssuranceLevel.Strong,
    effectiveGrants: {
      permissions: new Set([permission]),
      scopeGrants: [{
        permission,
        scopeType: 'class_group',
        scopeEntityIds: [scopeIds.split(':')[0] ?? scopeIds],
      }],
      scopeIdsByPermission: { [permission]: scopeIds },
      isElevated: false,
    },
  })
}

describe('actorHasAnyPermission', () => {
  test('returns false for non-interactive actors', () => {
    const system = createSystemActorMetadata({
      schoolId: 'school-1',
      systemId: 'test',
      requestId: 'test',
      reason: 'unit-test',
    })
    expect(actorHasAnyPermission(system, [Permission.STUDENT_READ])).toBe(false)
  })

  test('returns true when any requested permission is granted', () => {
    const actor = scopedStaff(Permission.GRADE_READ, 'class-1')
    expect(actorHasAnyPermission(actor, [Permission.GRADE_READ, Permission.PAYMENT_READ])).toBe(true)
  })

  test('treats empty permission list as any grant for interactive actors', () => {
    const actor = scopedStaff(Permission.GRADE_READ, 'class-1')
    expect(actorHasAnyPermission(actor, [])).toBe(true)
  })
})

describe('actorHasSchoolWideGrant', () => {
  test('returns true for staff with school-wide scope grants', () => {
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'test',
      authenticatedAt: now,
      assuranceLevel: ActorAssuranceLevel.Strong,
      effectiveGrants: {
        permissions: new Set([Permission.STUDENT_READ]),
        scopeGrants: [{
          permission: Permission.STUDENT_READ,
          scopeType: 'school',
          scopeEntityIds: ['school-1'],
        }],
        isElevated: false,
      },
    })
    expect(actorHasSchoolWideGrant(actor, [Permission.STUDENT_READ])).toBe(true)
  })

  test('returns true for elevated staff', () => {
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'test',
      authenticatedAt: now,
      assuranceLevel: ActorAssuranceLevel.Strong,
      effectiveGrants: {
        permissions: new Set([Permission.STUDENT_READ]),
        scopeGrants: [],
        isElevated: true,
      },
    })
    expect(actorHasSchoolWideGrant(actor, [Permission.STUDENT_READ])).toBe(true)
  })
})

describe('actorGrantCoversResourcePath', () => {
  test('returns false for non-interactive actors', () => {
    const system = createSystemActorMetadata({
      schoolId: 'school-1',
      systemId: 'test',
      requestId: 'test',
      reason: 'unit-test',
    })
    expect(actorGrantCoversResourcePath(system, Permission.GRADE_READ, 'class-1')).toBe(false)
  })

  test('returns true for elevated staff with permission', () => {
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'test',
      authenticatedAt: now,
      assuranceLevel: ActorAssuranceLevel.Strong,
      effectiveGrants: {
        permissions: new Set([Permission.GRADE_READ]),
        scopeGrants: [],
        isElevated: true,
      },
    })
    expect(actorGrantCoversResourcePath(actor, Permission.GRADE_READ, 'class-1')).toBe(true)
  })

  test('uses scopeIdsByPermission when present', () => {
    const actor = scopedStaff(Permission.GRADE_READ, 'class-1')
    expect(actorGrantCoversResourcePath(actor, Permission.GRADE_READ, 'class-1')).toBe(true)
    expect(actorGrantCoversResourcePath(actor, Permission.GRADE_READ, 'class-2')).toBe(false)
  })

  test('covers class subject resource paths via scopeIdsByPermission', () => {
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'test',
      authenticatedAt: now,
      assuranceLevel: ActorAssuranceLevel.Strong,
      effectiveGrants: {
        permissions: new Set([Permission.EXAM_CONFIG_READ]),
        scopeGrants: [],
        scopeIdsByPermission: { [Permission.EXAM_CONFIG_READ]: 'class-1:cs-1' },
        isElevated: false,
      },
    })
    expect(actorGrantCoversResourcePath(actor, Permission.EXAM_CONFIG_READ, 'class-1:cs-1')).toBe(true)
  })
})

describe('actorGrantCoversAny', () => {
  test('returns false when actor lacks permission for scoped entity', () => {
    const actor = scopedStaff(Permission.GRADE_READ, 'class-1')
    expect(actorGrantCoversAny(actor, [Permission.GRADE_READ], 'class_group', 'class-2')).toBe(false)
  })

  test('returns true when scoped grant covers entity', () => {
    const actor = scopedStaff(Permission.GRADE_READ, 'class-1')
    expect(actorGrantCoversAny(actor, [Permission.GRADE_READ], 'class_group', 'class-1')).toBe(true)
  })
})

describe('actorGrantCoversAnyResourcePath', () => {
  test('returns true when any permission covers the resource path', () => {
    const actor = scopedStaff(Permission.GRADE_READ, 'class-1')
    expect(actorGrantCoversAnyResourcePath(
      actor,
      [Permission.GRADE_READ, Permission.PAYMENT_READ],
      'class-1',
    )).toBe(true)
  })
})
