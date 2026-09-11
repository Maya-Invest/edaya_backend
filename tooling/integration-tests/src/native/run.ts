import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

// Always create a new local cluster. Never load a project DATABASE_URL or reset
// a database that this process did not create.
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
    const result = spawnSync('bun', ['test', 'src/native', '--parallel=1'], {
      stdio: 'inherit',
      env: { ...process.env, EDAYA_NATIVE_TEST_URL: `postgres://edaya_rc@127.0.0.1:${port}/postgres` },
    })
    if (result.error)
      throw result.error
    process.exitCode = result.status ?? 1
  }
  finally {
    if (started)
      run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop'])
    rmSync(directory, { recursive: true, force: true })
  }
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
