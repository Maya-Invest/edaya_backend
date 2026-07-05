import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Monorepo root (`edaya_backend`). */
export const repoRoot = path.resolve(packageRoot, '../..')

export const paths = {
  dev: path.join(repoRoot, 'tooling/repo/dev/start-local-dev.ts'),
  doctor: path.join(repoRoot, 'tooling/repo/ci/doctor.ts'),
  checkBoundaries: path.join(repoRoot, 'tooling/repo/ci/check-boundaries.ts'),
  seed: path.join(repoRoot, 'tooling/seeding/scripts/seed.ts'),
  dbBrowser: path.join(repoRoot, 'tooling/repo/dev/db-browser.ts'),
  openapiCheck: path.join(repoRoot, 'tooling/repo/openapi/check-drift.ts'),
  openapiExport: path.join(repoRoot, 'tooling/repo/openapi/export.ts'),
  openapiGenerate: path.join(repoRoot, 'tooling/repo/openapi/update.ts'),
  smokeStaging: path.join(repoRoot, 'tooling/integration-tests/scripts/smoke-staging.ts'),
  smokeNovu: path.join(repoRoot, 'tooling/integration-tests/smoke/novu-e2e.ts'),
  testR2: path.join(repoRoot, 'tooling/repo/dev/r2-check-credentials.ts'),
  configureR2Cors: path.join(repoRoot, 'tooling/repo/dev/r2-configure-cors.ts'),
  novuBootstrap: path.join(repoRoot, 'tooling/novu-ops/bootstrap/cli.ts'),
  novuCleanup: path.join(repoRoot, 'tooling/novu-ops/cleanup/cli.ts'),
  dbMigrate: path.join(repoRoot, 'tooling/db-migrate/scripts/migrate-target.ts'),
  apiRoot: path.join(repoRoot, 'apps/api'),
} as const
