import { Permission } from '@edaya/authorization'
import { describe, expect, test } from 'bun:test'
import {
  listPermissionsWithCatalogScope,
  listTenantWidePermissions,
} from '../../src/permissions/catalog-queries'
import {
  getPermissionCatalogEntry,
  listPermissionCatalog,
} from '../../src/scope/permission-catalog'

describe('permission catalog queries', () => {
  test('lists permissions for a catalog scope', () => {
    const classGroupPermissions = listPermissionsWithCatalogScope('class_group')
    expect(classGroupPermissions).toContain(Permission.GRADE_INPUT)
    expect(classGroupPermissions.every(permission => typeof permission === 'string')).toBe(true)
  })

  test('lists tenant-wide permissions without catalog scope', () => {
    const tenantWide = listTenantWidePermissions()
    expect(tenantWide.length).toBeGreaterThan(0)
    expect(tenantWide).not.toContain(Permission.GRADE_INPUT)
  })

  test('lists permission catalog entries', () => {
    const catalog = listPermissionCatalog()
    expect(catalog.length).toBeGreaterThan(0)
    expect(getPermissionCatalogEntry(Permission.GRADE_INPUT).scope).toBe('class_group')
  })
})
