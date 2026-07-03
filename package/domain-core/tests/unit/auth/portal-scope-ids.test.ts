import { describe, expect, test } from 'bun:test'
import {
  buildPortalScopeIdsByPermission,
  GUARDIAN_PORTAL_PERMISSIONS,
  Permission,
  STUDENT_PORTAL_PERMISSIONS,
} from '../../../src/capabilities/authorization'

describe('buildPortalScopeIdsByPermission', () => {
  test('maps student-scoped portal permissions to single-segment student ids', () => {
    const scopeIdsByPermission = buildPortalScopeIdsByPermission(GUARDIAN_PORTAL_PERMISSIONS, {
      studentIds: ['student-1', 'student-2'],
      classGroupIds: ['class-1'],
    })

    expect(scopeIdsByPermission[Permission.QUERY_STUDENT_DETAIL_READ]).toBe('student-1,student-2')
    expect(scopeIdsByPermission[Permission.QUERY_GUARDIAN_SELF_READ]).toBe('student-1,student-2')
  })

  test('maps class-group portal permissions to single-segment class group ids', () => {
    const scopeIdsByPermission = buildPortalScopeIdsByPermission(STUDENT_PORTAL_PERMISSIONS, {
      studentIds: ['student-1'],
      classGroupIds: ['class-1', 'class-2'],
    })

    expect(scopeIdsByPermission[Permission.ATTENDANCE_READ]).toBe('class-1,class-2')
    expect(scopeIdsByPermission[Permission.QUERY_CLASS_DIRECTORY_READ]).toBe('class-1,class-2')
  })

  test('maps tenant-wide portal permissions to empty scopeIds', () => {
    const scopeIdsByPermission = buildPortalScopeIdsByPermission(STUDENT_PORTAL_PERMISSIONS, {
      studentIds: ['student-1'],
      classGroupIds: ['class-1'],
    })

    expect(scopeIdsByPermission[Permission.PAYMENT_READ]).toBe('')
    expect(scopeIdsByPermission[Permission.QUERY_WORKSPACE_READ]).toBe('')
  })
})
