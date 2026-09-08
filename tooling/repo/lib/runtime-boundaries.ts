import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

function findWranglerEnvRouteMismatches(wrangler: string): RuntimeBoundaryViolation[] {
  const violations: RuntimeBoundaryViolation[] = []

  for (const envName of ['staging', 'production'] as const) {
    const envBlock = wrangler.match(new RegExp(`"${envName}"\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\}(?=,|\\s*\\})`))?.[1]
    if (!envBlock) {
      continue
    }

    const authUrl = envBlock.match(/"BETTER_AUTH_URL"\s*:\s*"([^"]+)"/)?.[1]
    const routePattern = envBlock.match(/"pattern"\s*:\s*"([^"]+)"/)?.[1]
    if (!authUrl || !routePattern) {
      continue
    }

    let authHost: string
    try {
      authHost = new URL(authUrl).hostname
    }
    catch {
      violations.push({
        label: `wrangler ${envName} route`,
        message: `env.${envName} BETTER_AUTH_URL is not a valid URL: ${authUrl}`,
      })
      continue
    }

    if (authHost !== routePattern) {
      violations.push({
        label: `wrangler ${envName} route`,
        message: `env.${envName} routes[0].pattern (${routePattern}) must match BETTER_AUTH_URL host (${authHost})`,
      })
    }
  }

  return violations
}

export function findRuntimeBoundaryViolations(repoRoot: string): RuntimeBoundaryViolation[] {
  const violations: RuntimeBoundaryViolation[] = []

  const envExample = readRepoFile(repoRoot, 'apps/api/.env.example')
  if (!envExample) {
    violations.push({
      label: 'missing apps/api/.env.example',
      message: 'apps/api/.env.example is required for local runtime documentation',
    })
  }
  else {
    if (!/\bRUNTIME=local\b/.test(envExample)) {
      violations.push({
        label: 'local env example',
        message: 'apps/api/.env.example must set RUNTIME=local',
      })
    }
    if (/DATABASE_URL=postgres:\/\//.test(envExample)) {
      violations.push({
        label: 'local env example',
        message: 'apps/api/.env.example must not default DATABASE_URL to postgres://',
      })
    }
    if (!/DATABASE_URL=pglite:\.data\/school/.test(envExample)) {
      violations.push({
        label: 'local env example',
        message: 'apps/api/.env.example must default DATABASE_URL to pglite:.data/school',
      })
    }
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

  const authEmailDelivery = readRepoFile(repoRoot, 'apps/api/src/runtime/shared/adapters/auth-email-delivery.ts')
  if (authEmailDelivery && !authEmailDelivery.includes('env.RUNTIME === "in-memory"')) {
    violations.push({
      label: 'in-memory auth email boundary',
      message: 'resolveAuthEmailDelivery must not use Novu on RUNTIME=in-memory',
    })
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
        message: 'apps/api/wrangler.jsonc must use a single heartbeat cron (*/5 * * * *), not per-job triggers',
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
        if (expressions.length !== 1 || expressions[0] !== '*/5 * * * *') {
          violations.push({
            label: 'wrangler cron',
            message: `each wrangler triggers.crons must contain only "*/5 * * * *" (found: ${expressions.join(', ') || 'none'})`,
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

    violations.push(...findWranglerEnvRouteMismatches(wrangler))
  }

  return violations
}
