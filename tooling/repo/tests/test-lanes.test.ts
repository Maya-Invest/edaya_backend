import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'bun:test'
import { root } from '../ops/runtime'

test('unit selection excludes integrations and rejects database or server allocation', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'edaya-test-lanes-'))
  const marker = resolve(directory, 'executed')
  try {
    writeFileSync(resolve(directory, 'behavior.test.ts'), `
      import {test, expect} from 'bun:test';
      import {PGlite} from ${JSON.stringify(import.meta.resolve('@electric-sql/pglite'))};
      import {appendFileSync} from 'node:fs';
      test('unit fixture', () => {
        expect(() => new PGlite()).toThrow('require an .integration.test.ts');
        expect(() => Bun.serve({fetch: () => new Response('unexpected')})).toThrow('require an .integration.test.ts');
        appendFileSync(${JSON.stringify(marker)}, 'unit');
      });
    `)
    writeFileSync(resolve(directory, 'behavior.integration.test.ts'), `
      import {test} from 'bun:test';
      import {appendFileSync} from 'node:fs';
      test('integration fixture', () => appendFileSync(${JSON.stringify(marker)}, 'integration'));
    `)
    const run = async (args: string[]) => {
      const child = Bun.spawn([process.execPath, 'test', ...args], { cwd: directory, stdout: 'pipe', stderr: 'pipe' })
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      expect({ code, output: code === 0 ? '' : stdout + stderr }).toEqual({ code: 0, output: '' })
    }
    await run(['--path-ignore-patterns', '**/*.integration.test.ts', '--preload', resolve(root, 'tooling/test-support/unit-preload.ts')])
    expect(readFileSync(marker, 'utf8')).toBe('unit')
    await run(['.integration.test.ts'])
    expect(readFileSync(marker, 'utf8')).toBe('unitintegration')
  }
  finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
