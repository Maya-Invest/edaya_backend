import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'bun:test'

const drizzleDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle')
const journal = JSON.parse(
  readFileSync(path.join(drizzleDir, 'meta/_journal.json'), 'utf8'),
) as { entries: Array<{ idx: number, tag: string }> }

describe('drizzle migration journal parity', () => {
  test('every migration sql file is registered in meta/_journal.json in order', () => {
    const sqlTags = readdirSync(drizzleDir)
      .filter(name => /^\d{4}_.+\.sql$/.test(name))
      .map(name => name.replace(/\.sql$/, ''))
      .sort()

    const journalTags = journal.entries.map(entry => entry.tag)
    expect(journalTags).toEqual(sqlTags)

    const journalIndexes = journal.entries.map(entry => entry.idx)
    expect(journalIndexes).toEqual(journal.entries.map((_, index) => index))
  })
})
