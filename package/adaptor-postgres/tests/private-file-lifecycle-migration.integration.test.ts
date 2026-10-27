import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'
import { migrationDirectory } from './support/authorization-database'

const migration = readFileSync(join(migrationDirectory, '0018_private_file_lifecycle.sql'), 'utf8')

test('private-file migration backfills existing attachment/photo references without changing records', async () => {
  const db = new PGlite()
  try {
    for (const file of readdirSync(migrationDirectory).filter(file => /^00(?:0\d|1[0-7])_.*\.sql$/.test(file)).sort())
      await db.exec(readFileSync(join(migrationDirectory, file), 'utf8'))
    await db.exec(`INSERT INTO schools (id, name, time_zone, created_at) VALUES ('legacy-school', 'Legacy', 'UTC', now());
      INSERT INTO staff_members (id, school_id, first_name, last_name, is_active, created_at, photo_url)
        VALUES ('legacy-staff', 'legacy-school', 'Legacy', 'Photo', true, now(), 'https://api.test/core/files/legacy-attachment/content');
      INSERT INTO attachments (id, school_id, owner_kind, owner_id, file_name, storage_key, status, created_at)
        VALUES ('legacy-attachment', 'legacy-school', 'staff', 'legacy-staff', 'photo.png', 'legacy-school/photo.png', 'ready', now());`)
    const before = await db.query('SELECT * FROM staff_members')
    await db.exec(migration)
    expect((await db.query('SELECT * FROM staff_members')).rows).toEqual(before.rows)
    expect((await db.query('SELECT source_type, source_id, attachment_id, storage_key FROM private_file_references ORDER BY source_type')).rows).toEqual([
      { source_type: 'attachment', source_id: 'legacy-attachment', attachment_id: null, storage_key: 'legacy-school/photo.png' },
      { source_type: 'staff_members', source_id: 'legacy-staff', attachment_id: 'legacy-attachment', storage_key: null },
    ])
    expect((await db.query('SELECT isfinite(protected_until) AS finite FROM private_file_objects')).rows).toEqual([{ finite: false }])
    await expect(db.exec('DELETE FROM attachments WHERE id = \'legacy-attachment\'')).rejects.toThrow()
    expect((await db.query('SELECT id FROM attachments')).rows).toEqual([{ id: 'legacy-attachment' }])
  }
  finally {
    await db.close()
  }
})
