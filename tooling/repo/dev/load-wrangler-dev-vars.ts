import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import dotenv from 'dotenv'
import dotenvExpand from 'dotenv-expand'

const repoRoot = resolve(import.meta.dirname, '../../..')
const devVarsFile = resolve(repoRoot, 'apps/api/.dev.vars')

/** Load `apps/api/.dev.vars` for Wrangler / Cloudflare ops (`wrangler dev`, R2 scripts). */
export function loadWranglerDevVars(): void {
  if (existsSync(devVarsFile)) {
    dotenvExpand.expand(dotenv.config({ path: devVarsFile }))
  }
}
