import { writeFileSync } from 'node:fs'
import process from 'node:process'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'

const output = process.argv[2]
if (!output)
  throw new Error('Pass a private output filename for the identity account manifest')
const context = resolveDevSeedContext()
const accounts = new Map<string, { email: string, name: string }>()
for (const account of [...context.staffAccounts, ...context.teacherAccounts, ...context.guardianAccounts]) {
  accounts.set(account.email.toLowerCase(), { email: account.email.toLowerCase(), name: account.name })
}
writeFileSync(output, JSON.stringify([...accounts.values()]), { mode: 0o600 })
console.log(`Exported ${accounts.size} ${context.datasetId} fixture accounts to a private file`)
