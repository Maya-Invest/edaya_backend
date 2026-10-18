import { Permission } from '@edaya/authorization'
import { describe, expect, test } from 'bun:test'
import {
  getPermissionCatalogEntry,
  listPermissionCatalog,
  listPermissionsWithCatalogScope,
  listTenantWidePermissions,
} from '../../src/permissions/catalog-queries'

describe('permission catalog queries', () => {
  test('lists permissions for a catalog scope', () => {
    const classGroupPermissions = listPermissionsWithCatalogScope('class_group')
    expect(classGroupPermissions).toContain(Permission.GRADE_MANAGE)
    expect(classGroupPermissions.every(permission => typeof permission === 'string')).toBe(true)
  })

  test('lists tenant-wide permissions without catalog scope', () => {
    const tenantWide = listTenantWidePermissions()
    expect(tenantWide.length).toBeGreaterThan(0)
    expect(tenantWide).not.toContain(Permission.GRADE_MANAGE)
    expect(tenantWide).not.toContain(Permission.ATTENDANCE_VALIDATE)
    expect(tenantWide).not.toContain(Permission.REPORT_CARD_PUBLISH)
  })

  test('lists permission catalog entries', () => {
    const catalog = listPermissionCatalog()
    expect(catalog.length).toBeGreaterThan(0)
    expect(getPermissionCatalogEntry(Permission.GRADE_MANAGE).scopePolicy).toEqual({ mode: 'resources', allowedKinds: ['grade_level', 'subject', 'class_group'], allowAll: true })
    expect(getPermissionCatalogEntry(Permission.STAFF_READ).scopePolicy).toEqual({ mode: 'none' })
    expect(getPermissionCatalogEntry(Permission.PLATFORM_USER_READ).staffAssignable).toBe(false)
  })
})
