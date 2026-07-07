import { describe, expect, test } from 'bun:test'
import {
  createBootstrapStaffActorMetadata,
  ELEVATED_STAFF_PERMISSIONS,
  Permission,
} from '../../../src/capabilities/authorization'

describe('createBootstrapStaffActorMetadata', () => {
  test('creates elevated staff actor with platform register and elevated permissions', () => {
    const actor = createBootstrapStaffActorMetadata({
      schoolId: 'school-1',
      requestId: 'bootstrap-request',
    })

    expect(actor.kind).toBe('staff')
    expect(actor.staffMemberId).toBe('bootstrap')
    expect(actor.subjectId).toBe('bootstrap')
    expect(actor.schoolId).toBe('school-1')
    expect(actor.effectiveGrants.isElevated).toBe(true)
    expect(actor.effectiveGrants.permissions.has(Permission.PLATFORM_REGISTER_SCHOOL)).toBe(true)
    for (const permission of ELEVATED_STAFF_PERMISSIONS) {
      expect(actor.effectiveGrants.permissions.has(permission)).toBe(true)
    }
  })

  test('honors explicit staff member and subject ids', () => {
    const actor = createBootstrapStaffActorMetadata({
      schoolId: 'school-1',
      requestId: 'bootstrap-request',
      staffMemberId: 'owner-1',
      subjectId: 'subject-owner',
    })

    expect(actor.staffMemberId).toBe('owner-1')
    expect(actor.subjectId).toBe('subject-owner')
  })
})
