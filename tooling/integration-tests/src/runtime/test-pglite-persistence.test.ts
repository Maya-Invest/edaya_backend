import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SEED_SCHOOL_ID } from '@edaya/dev-fixtures'
import { seedMinimalSchool } from '@edaya/seeding'
import { afterEach, describe, expect, it } from 'bun:test'
import { getApiRuntime, resetApiRuntimesForTests } from '@/runtime/local/registry'
import { createApiPgliteTestEnv } from '../support/api-pglite-env'

describe('persisted PGlite runtime', () => {
  let dataDir: string | undefined

  afterEach(async () => {
    await resetApiRuntimesForTests()
    if (dataDir) {
      rmSync(dataDir, { recursive: true, force: true })
      dataDir = undefined
    }
  })

  it('keeps school data across runtime restarts', async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'edaya-pglite-'))
    const env = createApiPgliteTestEnv({
      RUNTIME: 'local',
      DATABASE_URL: `pglite:${dataDir}`,
    })

    const firstRuntime = await getApiRuntime(env)
    const firstApplication = await firstRuntime.getSchoolApplication()
    await seedMinimalSchool(firstApplication)
    await firstRuntime.close()
    await resetApiRuntimesForTests()

    const secondRuntime = await getApiRuntime(env)
    const secondApplication = await secondRuntime.getSchoolApplication()
    const school = await secondApplication.repositories.schools.findById(SEED_SCHOOL_ID)

    expect(school?.id).toBe(SEED_SCHOOL_ID)
    await secondRuntime.close()
  })
})
