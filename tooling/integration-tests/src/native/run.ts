import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve as resolvePath } from 'node:path'
import process from 'node:process'
import { nativeTestExitCode } from './test-result'

// Always create a new local cluster. Never load a project DATABASE_URL or reset
// a database that this process did not create.
const seedSuite = process.argv.includes('--seed')
const benchmarkSuite = process.argv.includes('--benchmarks')
if (seedSuite && benchmarkSuite)
  throw new Error('Choose either seed integration or benchmarks')
const directory = mkdtempSync(join(tmpdir(), 'edaya-rc-postgres-'))
const data = join(directory, 'data')
let started = false

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error)
    throw result.error
  if (result.status !== 0)
    throw new Error(`${command} failed with status ${result.status}`)
}

async function main() {
  try {
    const server = createServer()
    const port = await new Promise<number>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        if (!address || typeof address === 'string') {
          reject(new Error('Unable to reserve a local test port'))
          return
        }
        server.close(error => error ? reject(error) : resolve(address.port))
      })
    })
    run('initdb', ['-D', data, '-A', 'trust', '-U', 'edaya_rc', '--no-locale', '--encoding=UTF8'])
    run('pg_ctl', ['-D', data, '-l', join(directory, 'server.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${directory}`, '-w', 'start'])
    started = true
    const reportPath = join(directory, 'results.xml')
    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn('bun', ['test', seedSuite ? 'src/seed' : benchmarkSuite ? 'src/benchmarks' : 'src/native', '--parallel=1', '--reporter=junit', `--reporter-outfile=${reportPath}`, ...process.argv.slice(2).filter(arg => arg !== '--seed' && arg !== '--benchmarks')], {
        stdio: 'inherit',
        env: {
          ...process.env,
          EDAYA_BENCHMARK_OUTPUT: benchmarkSuite ? process.env.EDAYA_BENCHMARK_OUTPUT ?? resolvePath(import.meta.dirname, '../../../../.ci-evidence/dashboard-benchmark.json') : undefined,
          EDAYA_IMPORT_BENCHMARK_OUTPUT: benchmarkSuite ? process.env.EDAYA_IMPORT_BENCHMARK_OUTPUT ?? resolvePath(import.meta.dirname, '../../../../.ci-evidence/enrollment-benchmark.json') : undefined,
          EDAYA_NATIVE_SEED: seedSuite ? '1' : '',
          EDAYA_NATIVE_TEST_URL: `postgres://edaya_rc@127.0.0.1:${port}/postgres`,
        },
      })
      const interrupt = () => child.kill('SIGINT')
      process.once('SIGINT', interrupt)
      child.once('error', reject)
      child.once('exit', (code) => {
        process.removeListener('SIGINT', interrupt)
        resolve(code ?? 130)
      })
    })
    return nativeTestExitCode(exitCode, readFileSync(reportPath, 'utf8'))
  }
  finally {
    if (started)
      run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop'])
    rmSync(directory, { recursive: true, force: true })
  }
}

void main().then(code => process.exit(code)).catch((error) => {
  console.error(error)
  process.exit(1)
})
