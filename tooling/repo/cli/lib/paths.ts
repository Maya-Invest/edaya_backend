import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Monorepo root (`edaya_backend`). */
export const repoRoot = path.resolve(packageRoot, '../..')

export const paths = {
  dev: path.join(repoRoot, 'tooling/repo/dev/start-local-dev.ts'),
  doctor: path.join(repoRoot, 'tooling/repo/ci/doctor.ts'),
  checkBoundaries: path.join(repoRoot, 'tooling/repo/ci/check-boundaries.ts'),
  checkTestNaming: path.join(repoRoot, 'tooling/repo/ci/check-test-naming.ts'),
  seed: path.join(repoRoot, 'tooling/seeding/scripts/seed.ts'),
  dbBrowser: path.join(repoRoot, 'tooling/repo/dev/db-browser.ts'),
  openapiCheck: path.join(repoRoot, 'tooling/repo/openapi/check-drift.ts'),
  openapiExport: path.join(repoRoot, 'tooling/repo/openapi/export.ts'),
  openapiGenerate: path.join(repoRoot, 'tooling/repo/openapi/update.ts'),
  smokeStaging: path.join(repoRoot, 'tooling/integration-tests/scripts/smoke-staging.ts'),
  testR2: path.join(repoRoot, 'tooling/repo/dev/r2-check-credentials.ts'),
  configureR2Cors: path.join(repoRoot, 'tooling/repo/dev/r2-configure-cors.ts'),
  dbMigrate: path.join(repoRoot, 'tooling/repo/db/school/migrate-target.ts'),
  dbReset: path.join(repoRoot, 'tooling/repo/db/school/reset-target.ts'),
  dbFlatten: path.join(repoRoot, 'tooling/repo/db/school/flatten-school-migrations.ts'),
  codegen: path.join(repoRoot, 'tooling/repo/codegen/bin/edaya-codegen.ts'),
  identityMigrate: path.join(repoRoot, 'tooling/repo/db/identity/migrate.ts'),
  identityWipe: path.join(repoRoot, 'tooling/repo/db/identity/wipe.ts'),
  devContainer: path.join(repoRoot, 'tooling/api-dev-container/run.sh'),
  apiRoot: path.join(repoRoot, 'apps/api'),
  smokeNotify: path.join(repoRoot, 'tooling/integration-tests/smoke/notify-e2e.ts'),
} as const
