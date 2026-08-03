import { describe, expect, test } from 'bun:test'
import { resolveEffectiveGrants } from '../../src/resolution/resolve-effective-grants'
import { Consortium, School } from '@edaya/core'
import { asAuthorizationRepos, createGrantRepos } from '../support/resolve-grants-fixtures'
import { ELEVATED_STAFF_PERMISSIONS } from '../../src/grants/system-role-permissions'

describe('resolveEffectiveGrants consortium owner', () => {
  test('elevates staff who owns the school consortium', async () => {
    const base = createGrantRepos([], undefined, 'consortium-owner')
    const repositories = asAuthorizationRepos({
      ...base,
      schools: {
        findById: async () => new School({
          id: 'school-1',
          name: 'School',
          timeZone: 'UTC',
          consortiumId: 'cons-1',
        }),
      },
      consortiums: {
        findById: async () => new Consortium({
          id: 'cons-1',
          name: 'Groupe',
          ownerSubjectId: 'consortium-owner',
        }),
      },
    })

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      repositories,
      academicYearId: 'year-1',
    })

    expect(grants.isElevated).toBe(true)
    expect(grants.permissions.size).toBe(ELEVATED_STAFF_PERMISSIONS.length)
  })
})
