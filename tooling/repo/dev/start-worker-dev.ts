import process from 'node:process'
import { apiRoot, readConfig, readSecrets } from '../../../apps/api/configuration/index.mjs'

// Validate secrets separately. Never put them on the command line.
readSecrets(`${apiRoot}/.dev.vars`)
const config = readConfig('staging')
const vars = Object.entries(config).flatMap(([key, value]) => ['--var', `${key}:${value}`])
const child = Bun.spawn(['bun', '--no-env-file', 'wrangler', 'dev', '--env', 'staging', '--env-file', '.dev.vars', ...vars, ...process.argv.slice(2)], {
  cwd: apiRoot,
  env: process.env,
  stdio: ['inherit', 'inherit', 'inherit'],
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => child.kill(signal))
}
process.exit(await child.exited)
