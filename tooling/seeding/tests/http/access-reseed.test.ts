import { Permission } from '@edaya/core'
import { expect, test } from 'bun:test'
import { createHttpAccessSeedPort } from '../../src/domains/access/adapters/http'
import { HttpSeedClient } from '../../src/transport/http/client'

test('repeat access seeding accepts only the authorized exact-profile-duplicate outcome', async () => {
  for (const [status, code] of [[409, 'PROFILE_GRANT_DUPLICATE'], [409, 'PROFILE_BOUND_GRANT_LOCKED'], [403, 'PROFILE_GRANT_DUPLICATE']] as const) {
    const client = new HttpSeedClient({ baseUrl: 'http://localhost:9999', fetch: async () => Response.json({ code }, { status }) })
    const saving = createHttpAccessSeedPort({ client, serviceAccountApiKey: 'fixture-key' }).saveStaffPermissionAssignment({
      id: 'grant',
      staffId: 'staff',
      schoolId: 'school',
      academicYearId: 'year',
      permission: Permission.STUDENT_READ,
      scopes: [{ kind: 'school' }],
      status: 'active',
    })
    if (status === 409 && code === 'PROFILE_GRANT_DUPLICATE')
      await saving
    else await expect(saving).rejects.toThrow()
  }
})
