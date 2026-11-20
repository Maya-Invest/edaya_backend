import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'

test('configuration migration backfills the existing derived short name and preserves model weights', async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE TABLE schools (id text PRIMARY KEY, name text NOT NULL, type text); CREATE TABLE report_card_definitions (id text); CREATE TABLE report_card_definition_sections (id text, weight integer NOT NULL); INSERT INTO report_card_definition_sections VALUES (\'s\', 2);')
    const names = ['Lycée — Cocody', 'School - North', 'Campus Nord', 'École  Internationale', 'A — B — C', 'A —']
    for (const [index, name] of names.entries()) await db.query('INSERT INTO schools VALUES ($1, $2, $3)', [String(index), name, 'k12'])
    await db.exec(await readFile(new URL('../drizzle/0041_configuration_editors.sql', import.meta.url), 'utf8'))
    const { rows } = await db.query<{ name: string, short_name: string }>('SELECT name, short_name FROM schools ORDER BY id')
    expect(rows.map(row => row.short_name)).toEqual(['Cocody', 'North', 'Campus', 'École', 'C', 'A'])
    expect((await db.query('SELECT type FROM schools').catch(() => null))).toBeNull()
    await db.exec('UPDATE report_card_definition_sections SET weight = 1.5 WHERE id = \'s\'')
    expect((await db.query<{ weight: number }>('SELECT weight FROM report_card_definition_sections')).rows[0]?.weight).toBe(1.5)
  }
  finally { await db.close() }
})
