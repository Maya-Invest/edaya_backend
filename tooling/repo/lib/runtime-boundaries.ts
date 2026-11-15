import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseJsonc, readConfig, validateSecrets } from '../../../apps/api/configuration/index.ts'
import { findWorkerParityViolations } from './worker-parity'

const HEARTBEAT_CRON = '*/5 * * * *'

export interface RuntimeBoundaryViolation {
  label: string
  message: string
}

function readRepoFile(repoRoot: string, relativePath: string): string | null {
  const filePath = resolve(repoRoot, relativePath)
  if (!existsSync(filePath)) {
    return null
  }
  return readFileSync(filePath, 'utf8')
}

function findWranglerEnvRouteMismatches(wrangler: string, repoRoot: string): RuntimeBoundaryViolation[] {
  const violations: RuntimeBoundaryViolation[] = []
  try {
    const config = parseJsonc(wrangler) as { env?: Record<string, { routes?: { pattern: string }[] }> }
    for (const target of ['staging', 'production']) {
      const settings = readConfig(target, resolve(repoRoot, 'apps/api'))
      const route = config.env?.[target === 'production' ? 'prod' : target]?.routes?.[0]?.pattern
      if (route && new URL(settings.API_ORIGIN!).hostname !== route) {
        violations.push({ label: `wrangler ${target} route`, message: `config.${target}.jsonc API_ORIGIN must match the Wrangler route` })
      }
    }
  }
  catch {
    violations.push({ label: 'API configuration', message: 'Expected valid local, staging, production and Wrangler configuration files' })
  }
  return violations
}

export function findRuntimeBoundaryViolations(repoRoot: string): RuntimeBoundaryViolation[] {
  const violations: RuntimeBoundaryViolation[] = []

  try {
    const local = readConfig('local', resolve(repoRoot, 'apps/api'))
    if (local.RUNTIME !== 'local' || !local.DATABASE_URL?.startsWith('pglite:')) {
      violations.push({ label: 'local configuration', message: 'config.local.jsonc must use RUNTIME=local and persisted PGlite' })
    }
    const secrets = JSON.parse(readRepoFile(repoRoot, 'apps/api/secrets.json.example') ?? '{}')
    validateSecrets(secrets, 'secrets.json.example')
  }
  catch {
    violations.push({ label: 'local configuration', message: 'Invalid config.local.jsonc or secrets.json.example' })
  }

  const localLoader = readRepoFile(repoRoot, 'apps/api/src/runtime/shared/env/local-loader.ts')
  if (localLoader) {
    if (localLoader.includes('loadEnvFile(".dev.vars")') || localLoader.includes('loadEnvFile(\'.dev.vars\')')) {
      violations.push({
        label: 'local env loader',
        message: 'local-loader.ts must not load apps/api/.dev.vars (Wrangler-only)',
      })
    }
  }

  const fileStorage = readRepoFile(repoRoot, 'apps/api/src/runtime/shared/adapters/file-storage.ts')
  if (fileStorage) {
    if (!/switch\s*\(\s*env\.RUNTIME\s*\)/.test(fileStorage)) {
      violations.push({
        label: 'flat file storage resolver',
        message: 'resolveFileStorage must switch on env.RUNTIME',
      })
    }
    if (/if\s*\(\s*isR2FileStorageConfigured\(env\)\s*\)\s*\{[\s\S]*?return createR2FileStorageFromEnv/.test(fileStorage)
      && !/case\s+"worker"/.test(fileStorage)) {
      violations.push({
        label: 'flat file storage resolver',
        message: 'resolveFileStorage must not upgrade to R2 before selecting the worker runtime',
      })
    }
  }

  const localSchoolDb = readRepoFile(repoRoot, 'apps/api/src/runtime/local/school-database.ts')
  if (localSchoolDb?.includes('createPostgresSchoolDatabase')) {
    violations.push({
      label: 'local school database',
      message: 'apps/api local school-database must not use createPostgresSchoolDatabase',
    })
  }

  const startLocalDev = readRepoFile(repoRoot, 'tooling/repo/dev/start-local-dev.ts')
  if (startLocalDev) {
    if (startLocalDev.includes('@edaya/notify')) {
      violations.push({
        label: 'local dev orchestrator',
        message: 'start-local-dev.ts must not start a separate @edaya/notify process',
      })
    }
    if (/gotenberg/i.test(startLocalDev) || startLocalDev.includes('@edaya/docs')) {
      violations.push({
        label: 'local dev orchestrator',
        message: 'start-local-dev.ts must not start Gotenberg or a docs process',
      })
    }
    if (startLocalDev.includes('.dev.vars')) {
      violations.push({
        label: 'local dev orchestrator',
        message: 'start-local-dev.ts must not load apps/api/.dev.vars (Wrangler-only)',
      })
    }
    if (startLocalDev.includes('isR2FileStorageConfigured')) {
      violations.push({
        label: 'local dev orchestrator',
        message: 'start-local-dev.ts must not gate local-files on R2 configuration',
      })
    }
  }

  const notificationGateway = readRepoFile(repoRoot, 'apps/api/src/runtime/shared/adapters/notification-gateway.ts')
  if (notificationGateway && !notificationGateway.includes('env.RUNTIME === "in-memory"')) {
    violations.push({
      label: 'in-memory notification boundary',
      message: 'resolveNotificationGateway must no-op on RUNTIME=in-memory',
    })
  }

  const documentRenderer = readRepoFile(repoRoot, 'apps/api/src/runtime/shared/adapters/document-renderer.ts')
  if (documentRenderer && !documentRenderer.includes('env.RUNTIME === "in-memory"')) {
    violations.push({
      label: 'in-memory document renderer boundary',
      message: 'resolveDocumentRenderer must no-op on RUNTIME=in-memory',
    })
  }

  for (const relativePath of [
    'apps/api/src/runtime/shared/adapters/auth-email-delivery.ts',
    'apps/api/src/runtime/shared/adapters/better-auth.ts',
    'apps/api/src/runtime/shared/adapters/first-party-auth.ts',
  ]) {
    if (existsSync(resolve(repoRoot, relativePath))) {
      violations.push({
        label: 'school identity extract',
        message: `${relativePath} must live in apps/api/src/identity, not school runtime adapters`,
      })
    }
  }

  if (existsSync(resolve(repoRoot, 'apps/cron'))) {
    violations.push({
      label: 'legacy cron app',
      message: 'apps/cron must be removed; scheduled cron runs on @edaya/api worker',
    })
  }

  if (existsSync(resolve(repoRoot, 'apps/notify'))) {
    violations.push({
      label: 'legacy notify app',
      message: 'apps/notify must be removed; notification send runs in-process on the school API',
    })
  }

  const wrangler = readRepoFile(repoRoot, 'apps/api/wrangler.jsonc')
  if (!wrangler) {
    violations.push({
      label: 'wrangler cron',
      message: 'apps/api/wrangler.jsonc is required for worker cron configuration',
    })
  }
  else {
    if (/0 2 \* \* \*/.test(wrangler) || /0 6 \* \* \*/.test(wrangler)) {
      violations.push({
        label: 'wrangler cron',
        message: `apps/api/wrangler.jsonc must use a single heartbeat cron (${HEARTBEAT_CRON}) for all jobs`,
      })
    }

    const cronBlocks = [...wrangler.matchAll(/"crons"\s*:\s*\[([^\]]*)\]/g)]
    if (cronBlocks.length === 0) {
      violations.push({
        label: 'wrangler cron',
        message: 'apps/api/wrangler.jsonc must declare triggers.crons heartbeat',
      })
    }
    else {
      for (const [, block] of cronBlocks) {
        const expressions = [...block.matchAll(/"([^"]+)"/g)].map(match => match[1])
        if (expressions.length !== 1 || expressions[0] !== HEARTBEAT_CRON) {
          violations.push({
            label: 'wrangler cron',
            message: `each wrangler triggers.crons must contain only "${HEARTBEAT_CRON}" (found: ${expressions.join(', ') || 'none'})`,
          })
          break
        }
      }
    }

    if (!wrangler.includes('"binding": "CRON_JOBS"')) {
      violations.push({
        label: 'wrangler cron queue',
        message: 'apps/api/wrangler.jsonc must declare CRON_JOBS queue producer binding',
      })
    }

    if (!wrangler.includes('"binding": "BROWSER"')) {
      violations.push({
        label: 'wrangler browser binding',
        message: 'apps/api/wrangler.jsonc must declare BROWSER binding for Browser Run',
      })
    }

    const compatibilityDate = wrangler.match(/"compatibility_date"\s*:\s*"([^"]+)"/)?.[1]
    if (!compatibilityDate || compatibilityDate < '2026-03-24') {
      violations.push({
        label: 'wrangler compatibility date',
        message: 'apps/api/wrangler.jsonc compatibility_date must be 2026-03-24 or later for BROWSER.quickAction',
      })
    }

    if (/\bALLOW_LEGACY_COOKIE_BUSINESS_AUTH\b|\bCOOKIE_DOMAIN\b/.test(wrangler)) {
      violations.push({
        label: 'wrangler identity extract',
        message: 'apps/api/wrangler.jsonc must not configure COOKIE_DOMAIN or ALLOW_LEGACY_COOKIE_BUSINESS_AUTH',
      })
    }

    if (/"vars"\s*:/.test(wrangler) || !/"keep_vars"\s*:\s*true/.test(wrangler)) {
      violations.push({ label: 'Worker variables', message: 'Wrangler must omit vars and enable keep_vars' })
    }
    violations.push(...findWranglerEnvRouteMismatches(wrangler, repoRoot))
    try {
      violations.push(...findWorkerParityViolations(parseJsonc(wrangler) as Record<string, unknown>))
    }
    catch {
      violations.push({ label: 'Worker environment parity', message: 'Invalid Wrangler JSONC' })
    }
  }

  return violations
}
