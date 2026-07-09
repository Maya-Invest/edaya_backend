import { School } from '@edaya/core'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/pglite'
import { PostgresSchoolRepositories } from './postgres-school-repositories'

describe('PostgresSchoolRepositories with PGlite', () => {
  let pglite: PGlite
  let repos: PostgresSchoolRepositories

  beforeEach(async () => {
    pglite = new PGlite()
    repos = new PostgresSchoolRepositories(drizzle(pglite))
    await repos.init({ driver: 'pglite' })
  })

  afterEach(async () => {
    await pglite.close()
  })

  test('persists and reads schools through PostgresStore', async () => {
    const school = new School({
      id: 'school-1',
      name: 'Edaya Academy',
      timeZone: 'Africa/Douala',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    await repos.schoolsStore.save(school)

    await expect(repos.schoolsStore.findById('school-1')).resolves.toMatchObject({
      id: 'school-1',
      name: 'Edaya Academy',
      timeZone: 'Africa/Douala',
    })
  })

  test('lists and counts schools with repository filters', async () => {
    await repos.schoolsStore.batchSave([
      new School({
        id: 'school-a',
        name: 'North Campus',
        timeZone: 'Africa/Douala',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      new School({
        id: 'school-b',
        name: 'South Campus',
        timeZone: 'Africa/Douala',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
    ])

    await expect(repos.schoolsStore.list({ name: 'North Campus' })).resolves.toHaveLength(1)
    await expect(repos.schoolsStore.count({})).resolves.toBe(2)
  })

  test('deletes persisted schools by id', async () => {
    await repos.schoolsStore.save(new School({
      id: 'school-delete',
      name: 'Temporary School',
      timeZone: 'Africa/Douala',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }))

    await repos.schoolsStore.delete('school-delete')
    await expect(repos.schoolsStore.findById('school-delete')).resolves.toBeUndefined()
  })
})
