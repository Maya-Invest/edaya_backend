import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { migrationDirectory } from './support/authorization-database'

describe('permission profile clean cutover', () => {
  let db: PGlite
  const cutover = readFileSync(resolve(migrationDirectory, '0037_permission_scope_defaults.sql'), 'utf8')
  beforeEach(async () => {
    db = new PGlite()
    for (const file of readdirSync(migrationDirectory).filter(name => /^\d{4}_.*\.sql$/.test(name) && name < '0037').sort())
      await db.exec(readFileSync(resolve(migrationDirectory, file), 'utf8'))
  })
  afterEach(async () => {
    await db.close()
  })
  test('installs scope sources and removes the profile scope field in a fresh database', async () => {
    await db.transaction(tx => tx.exec(cutover))
    const profile = await db.query<{ column_name: string }>('SELECT column_name FROM information_schema.columns WHERE table_name = \'staff_permission_profiles\'')
    expect(profile.rows.map(row => row.column_name)).not.toContain('scope_grain')
    expect((await db.query('SELECT * FROM staff_permission_scope_defaults')).rows).toHaveLength(0)
    expect((await db.query('SELECT * FROM staff_manual_permission_assignments')).rows).toHaveLength(0)
  })
  test('rejects old permission data before changing its schema', async () => {
    await db.exec('INSERT INTO schools (id, name, time_zone, created_at) VALUES (\'school\', \'School\', \'UTC\', now())')
    await db.exec('INSERT INTO staff_permission_profiles (id, school_id, name, scope_grain, permissions, created_at, updated_at) VALUES (\'profile\', \'school\', \'Legacy\', \'school\', \'[]\', now(), now())')
    await expect(db.transaction(tx => tx.exec(cutover))).rejects.toThrow('fresh school database')
    expect((await db.query('SELECT scope_grain FROM staff_permission_profiles')).rows).toEqual([{ scope_grain: 'school' }])
  })
})
