import { describe, expect, it } from 'bun:test'
import { readSchoolMigrationJournal } from './school-migration-journal'

describe('school migration historical hashes', () => {
  it('recognizes the deployed notification migration before the branding spelling change', () => {
    const journal = readSchoolMigrationJournal()
    const deployedHash = '4907673f03f977cec0d0c11722fc8ab5c2c41c198beef8c2da9fd89813420f4a'
    const entry = journal.find(entry => entry.tag === '0020_notification_copy_types')!
    expect(entry.hash).not.toBe(deployedHash)
    expect(entry.previousHashes).toContain(deployedHash)
    expect(journal.filter(entry => entry.previousHashes.includes(deployedHash))).toHaveLength(1)
  })
})
