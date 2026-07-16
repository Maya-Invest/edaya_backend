import { Permission } from '@edaya/authorization'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { describe, expect, test } from 'bun:test'
import { buildDevAccessSeedRecords } from './build-dev-access-seed-records'

/* eslint-disable-next-line dot-notation -- process.env index signature */
process.env['SEED_DATASET'] = 'demo-ci'

describe('buildDevAccessSeedRecords — demo-ci leadership scopes', () => {
  test('director role assignment includes class-group scope grants only', () => {
    const context = resolveDevSeedContext()
    const { staffRoleAssignmentRecords } = buildDevAccessSeedRecords(context)
    const director = staffRoleAssignmentRecords.find(assignment => assignment.staffId === 'ci-st5')

    expect(director?.scopeGrants?.length).toBeGreaterThan(0)
    expect(director?.scopeGrants?.every(grant => grant.scopeType === 'class_group')).toBe(true)
    expect(director?.scopeGrants?.some(grant => grant.permission === Permission.QUERY_TIMETABLE_READ)).toBe(true)
  })
})
