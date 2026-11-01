#!/usr/bin/env bun
import { resolve } from 'node:path'
import process from 'node:process'
import { loadLocalConfiguration } from '../../../apps/api/configuration/index.ts'
import { redact } from '../ops/runtime'
import { Services } from '../ops/services'

const repoRoot = resolve(import.meta.dirname, '../../..')
const apiRoot = resolve(repoRoot, 'apps/api')

loadLocalConfiguration(process.env, apiRoot)
process.env.LOCAL_OTP_CAPTURE ??= 'true'

console.log(`API and authentication on :${process.env.PORT}, local files on :${process.env.LOCAL_FILES_PORT}. OTP capture: ${process.env.LOCAL_OTP_CAPTURE}.`)

const services = new Services(true)
try {
  services.start('API', ['bun', '--no-env-file', '--watch', 'src/entries/local.ts'], apiRoot, process.env)
  services.start('Local files', ['bun', '--no-env-file', '--watch', 'tooling/repo/dev/local-files.ts'], repoRoot, process.env)
  await services.wait()
}
catch (error) {
  console.error(redact(error instanceof Error ? error.message : 'Local service failed'))
  process.exitCode = 1
}
finally { await services.stop('local-services.json') }
