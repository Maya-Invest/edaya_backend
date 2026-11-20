import process from 'node:process'
import { apiRoot, readConfig, readSecrets } from '../../../apps/api/configuration/index.ts'
import { redact } from '../ops/runtime'
import { Services } from '../ops/services'

// Validate secrets separately. Never put them on the command line.
readSecrets(`${apiRoot}/.dev.vars`)
const config = readConfig('staging')
const vars = Object.entries(config).flatMap(([key, value]) => ['--var', `${key}:${value}`])
const services = new Services(true)
try {
  services.start('Wrangler', ['bun', 'x', 'wrangler', 'dev', '--env', 'staging', '--env-file', '.dev.vars', ...vars, ...process.argv.slice(2)], apiRoot, process.env)
  await services.wait()
}
catch (error) {
  console.error(redact(error instanceof Error ? error.message : 'Worker preview failed'))
  process.exitCode = 1
}
finally { await services.stop('worker-preview.json') }
