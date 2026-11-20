import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'bun:test'
import { wipeLocalData } from './wipe-local-data'

test('school reset preserves identity accounts and other local data', async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'subject-school-reset-'))
  try {
    for (const directory of ['school', 'identity', 'files']) {
      await mkdir(join(repoRoot, '.data', directory), { recursive: true })
      await writeFile(join(repoRoot, '.data', directory, 'sentinel'), directory)
    }
    expect(await wipeLocalData({ repoRoot })).toEqual({ removed: true, dataDir: join(repoRoot, '.data', 'school') })
    await expect(readFile(join(repoRoot, '.data', 'school', 'sentinel'))).rejects.toThrow()
    for (const directory of ['identity', 'files'])
      expect(await readFile(join(repoRoot, '.data', directory, 'sentinel'), 'utf8')).toBe(directory)
    expect((await wipeLocalData({ repoRoot })).removed).toBe(false)
  }
  finally { await rm(repoRoot, { recursive: true, force: true }) }
})
