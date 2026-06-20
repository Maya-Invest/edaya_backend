#!/usr/bin/env bun

// Remote Neon/Postgres integration tests are disabled for now — use local PGlite only:
//   bun --filter @edaya/integration-tests test
//
// To re-enable remote suites, restore INTEGRATION_TEST_INCLUDE_REMOTE below and uncomment
// describeRemotePostgresIntegration in src/support/suite-runner.ts.

console.error('Remote integration tests (Neon/Postgres) are disabled. Run local tests with: bun test')
process.exit(0)

// import { spawnSync } from 'node:child_process'
// import path from 'node:path'
// import { fileURLToPath } from 'node:url'
//
// const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
//
// const result = spawnSync(
//   process.execPath,
//   [
//     'test',
//     '--parallel=1',
//     '--max-concurrency=1',
//     ...process.argv.slice(2),
//   ],
//   {
//     cwd: packageRoot,
//     stdio: 'inherit',
//     env: {
//       ...process.env,
//       INTEGRATION_TEST_INCLUDE_REMOTE: '1',
//     },
//   },
// )
//
// process.exit(result.status ?? 1)
