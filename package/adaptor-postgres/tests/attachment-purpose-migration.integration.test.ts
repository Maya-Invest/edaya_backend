import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'
import { migrationDirectory } from './support/authorization-database'

test('attachment purpose migration preserves legacy records and prevents declassification', async () => {
  const db = new PGlite()
  try {
    for (const file of readdirSync(migrationDirectory).filter(file => /^00(?:0\d|1[0-8])_.*\.sql$/.test(file)).sort())
      await db.exec(readFileSync(join(migrationDirectory, file), 'utf8'))
    await db.exec('INSERT INTO schools (id, name, time_zone, created_at) VALUES (\'school\', \'Legacy\', \'UTC\', now()); INSERT INTO attachments (id, school_id, owner_kind, owner_id, file_name, file_url, status, created_at) VALUES (\'legacy\', \'school\', \'staff\', \'staff\', \'legacy.pdf\', \'https://legacy.example/file\', \'ready\', now())')
    const before = (await db.query('SELECT * FROM attachments')).rows[0]
    await db.exec(readFileSync(join(migrationDirectory, '0019_attachment_purposes.sql'), 'utf8'))
    expect((await db.query('SELECT * FROM attachments')).rows).toEqual([{ ...before!, purpose: 'general' }])
    await expect(db.exec('UPDATE attachments SET purpose = \'fixture.private\' WHERE id = \'legacy\'')).rejects.toThrow()
    expect((await db.query('SELECT purpose FROM attachments')).rows).toEqual([{ purpose: 'general' }])
    await expect(db.exec('INSERT INTO attachments (id, school_id, owner_kind, owner_id, purpose, file_name, status, created_at) VALUES (\'invalid\', \'school\', \'staff\', \'staff\', \' invalid \', \'file.pdf\', \'ready\', now())')).rejects.toThrow()
  }
  finally {
    await db.close()
  }
})
