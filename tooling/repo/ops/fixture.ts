import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { root, run, waitForUrl } from './runtime'
import { Services } from './services'
/** Own all service processes and private credentials for one integration run. */
export async function fixture(command: string[], cwd: string): Promise<void> {
  if (!command.length)
    throw new Error('fixture requires a child command after --')
  const directory = mkdtempSync(resolve(tmpdir(), 'edaya-integration-'))
  const services = new Services()
  const apiPort = process.env.EDAYA_CI_API_PORT ?? '11999'
  const filesPort = process.env.EDAYA_CI_FILES_PORT ?? '19200'
  const api = `http://127.0.0.1:${apiPort}`
  const web = process.env.EDAYA_CI_WEBAPP_ORIGIN ?? 'http://127.0.0.1:14173'
  const trusted = [web, 'http://127.0.0.1:14174', 'http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173', 'http://127.0.0.1:4173'].join(',')
  const secretFile = resolve(directory, 'school.env')
  writeFileSync(secretFile, 'LOCAL_FILES_SECRET=disposable-integration-only\n', { mode: 0o600 })
  const env = { ...process.env, NODE_ENV: 'test', BACKEND_ROOT: root, EDAYA_BACKEND_ROOT: root, API_URL: api, EDAYA_API_URL: api, EDAYA_TEST_API_URL: api, API_ORIGIN: api, PORT: apiPort, DATABASE_URL: `pglite:${directory}/school-db`, AUTH_DATABASE_URL: `pglite:${directory}/account-db`, EDAYA_TEST_AUTH_DATABASE_URL: `pglite:${directory}/account-db`, EDAYA_TEST_PORT: apiPort, EDAYA_TEST_TRUSTED_ORIGINS: trusted, TRUSTED_ORIGINS: trusted, WEBAPP_ORIGIN: web, EMAIL_TRANSPORT: 'log', SMS_TRANSPORT: 'log', PHONE_AUTH_MODE: 'disabled', LOG_LEVEL: 'error', ALLOW_PUBLIC_SCHOOL_REGISTRATION: 'true', EDAYA_LOCAL_ENV_FILE: secretFile, LOCAL_FILES_URL: `http://127.0.0.1:${filesPort}`, LOCAL_FILES_PORT: filesPort, LOCAL_FILES_ROOT: `${directory}/files`, EDAYA_TEST_OTP_FILE: `${directory}/otp.jsonl`, EDAYA_TEST_CLOCK_FILE: `${directory}/clock-offset`, EDAYA_TEST_POLICY_FILE: `${directory}/privileged-accounts.json`, SEED_ENV_FILE: secretFile, SEED_API_URL: api, SEED_APP_ORIGIN: web }
  const start = (script: string) => services.start(script, ['bun', '--no-env-file', script], root, env)
  try {
    start('apps/api/src/identity/entries/testing.ts')
    await waitForUrl(`${api}/reference`, 120, () => services.assertRunning())
    start('tooling/repo/dev/local-files.ts')
    await waitForUrl(`${env.LOCAL_FILES_URL}/health`, 120, () => services.assertRunning())
    if (process.env.EDAYA_FIXTURE_SEED === 'true')
      await run(['bun', '--no-env-file', 'tooling/repo/ops/main.ts', 'maintenance', 'seed'], { env })
    await run(command, { cwd, env, timeout: 150 * 60000 })
  }
  finally {
    try {
      await services.stop(resolve(cwd, '.ci-evidence/backend-services.json'))
    }
    finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }
}
