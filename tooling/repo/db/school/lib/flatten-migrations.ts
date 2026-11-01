import { existsSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** Generate and validate before replacing anything; retain the old directory on success. */
export async function flattenMigrations(directory: string, generate: (output: string) => Promise<void>): Promise<string> {
  if (!existsSync(directory))
    throw new Error('Missing migration directory')
  const temporary = mkdtempSync(join(dirname(directory), '.migration-baseline-'))
  const output = join(temporary, 'drizzle')
  try {
    await generate(output)
    const sql = readdirSync(output).filter(name => name.endsWith('.sql'))
    if (sql.length !== 1 || !existsSync(join(output, 'meta', '_journal.json')))
      throw new Error('Expected exactly one generated baseline and its migration journal')
    const journal = JSON.parse(readFileSync(join(output, 'meta', '_journal.json'), 'utf8'))
    if (journal.entries?.length !== 1 || `${journal.entries[0].tag}.sql` !== sql[0] || !readFileSync(join(output, sql[0]!), 'utf8').trim())
      throw new Error('Invalid generated migration baseline/journal')
    const backup = `${directory}.backup-${Date.now()}`
    renameSync(directory, backup)
    try {
      renameSync(output, directory)
    }
    catch (error) {
      renameSync(backup, directory)
      throw error
    }
    return backup
  }
  finally { rmSync(temporary, { recursive: true, force: true }) }
}
