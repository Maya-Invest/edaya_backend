import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from 'bun:test'

test('file hooks reset beforeEach and test-body leases after failed tests and close storage', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'edaya-pool-lifecycle-'))
  try {
    const script = resolve(directory, 'lifecycle.test.ts')
    const helper = resolve(import.meta.dirname, 'support/pooled-database.ts')
    writeFileSync(script, `
      import { beforeEach, expect, test } from 'bun:test';
      import { usePooledDatabases } from ${JSON.stringify(helper)};
      const { createAuthorizationDatabase } = usePooledDatabases();
      let fixture;
      let previous;
      beforeEach(async () => { fixture = await createAuthorizationDatabase(); });
      test('intentional assertion failure', async () => {
        previous = fixture;
        await fixture.db.exec("UPDATE schools SET name = 'dirty' WHERE id = 'school-a'");
        expect(1).toBe(2);
      });
      test('beforeEach lease is isolated after failure', async () => {
        expect(fixture.db).toBe(previous.db);
        expect(fixture.repositories).not.toBe(previous.repositories);
        expect((await fixture.repositories.schools.findById('school-a')).name).toBe('A');
        const other = await createAuthorizationDatabase();
        expect(other.db).not.toBe(fixture.db);
        expect(await other.repositories.schools.count()).toBe(2);
      });
      test('all prior test-body leases were cleaned', async () => {
        expect(await fixture.repositories.schools.count()).toBe(2);
      });
    `)
    const child = Bun.spawn([process.execPath, 'test', script], { cwd: import.meta.dirname, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, EDAYA_TEST_POOL_METRICS: 'true' } })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(code).toBe(1)
    expect(stderr).toContain('2 pass')
    expect(stderr).toContain('1 fail')
    expect(stderr).not.toContain('unreleased')
    expect(stdout).toContain('"initializations":2,"acquisitions":4')
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}, 30000)
