# Local audit evidence — 8 September 2026

Baseline: `98b7a136`. All data used for the targeted checks was synthetic. No remote database or deployed API was probed.

## Existing checks

- `bun run verify`: exit 1. Repository hygiene passed; cached quality/build stages completed; two Novu bootstrap template tests failed.
- Uncached unit run excluding the local-files package: `bun x turbo run test --force --continue=always --filter='!@edaya/adaptor-local-fs' -- --dots`. Exit 1, 30 successful tasks of 31, zero cached tasks. 2,049 passing tests including three temporary audit probes, two failing Novu tests.
- Local-files tests initially could not bind their loopback server in the sandbox. Isolated `bun test tests/local-file-storage.test.ts` with networking permitted: 11 pass, 0 fail.
- Combined existing unit tests: 2,049 - 3 audit probes + 11 local-files tests = 2,057 pass, 2 fail.
- `bun run test:integration`: exit 0; API/runtime/adapter slice 13 pass across 6 files, auth/HTTP slice 31 pass across 13 files. Total 44 pass, 0 fail.
- The final targeted probe run below: 5 pass, 0 fail; these tests assert observed undesirable behavior and MUST NOT be used as a release gate asserting correctness.

Fresh package pass totals (before subtracting the three temporary API probes): core 271; client-codegen 6; auth adapter 9; R2 adapter 16; authorization 544; docs adapter 17; repository tooling 47; notify adapter 15; service 521; fixtures 90; Novu adapter 47; Novu operations 13 (plus 2 failures); seeding 63; Postgres adapter 98; database tooling 6; API 286. Local-files separately: 11.

## Targeted probe output

```text
bun test v1.3.14 (0d9b296a)

tests/audit-launch-probes.test.ts:
AUDIT: production-config public signup + seed header -> emailVerified=true
(pass) Isolated audit observations (assert current behavior, not desired behavior) > seed header verifies a new user under production auth configuration [1472.41ms]
AUDIT: actual PostgresStore/PGlite count returns both schools; list rejects mixed rows
(pass) Isolated audit observations (assert current behavior, not desired behavior) > elevated count crosses tenants with empty or mixed-school filters [819.83ms]
AUDIT: attachAuthDatabase disposal does not dispose the supplied handle
(pass) Isolated audit observations (assert current behavior, not desired behavior) > attached auth handle discards disposal ownership [9.74ms]
AUDIT: guardian-scope event leaves guardian portal scope cache intact
(pass) Isolated audit observations (assert current behavior, not desired behavior) > guardian scope invalidation leaves the actual portal cache populated [0.25ms]
AUDIT: existing pay1 amount=400 replay changes paidAmount from 400 to 800 (existing workflow test harness)
(pass) Isolated audit observations (assert current behavior, not desired behavior) > replaying an existing payment adds its amount to the fee balance again [7.16ms]

 5 pass
 0 fail
 9 expect() calls
Ran 5 tests across 1 file. [3.30s]
```

## Reproduction source

For controlled reproduction on this baseline, temporarily place the following at `apps/api/tests/audit-launch-probes.test.ts` and run `NODE_ENV=test bun test ./tests/audit-launch-probes.test.ts --timeout 120000` from `apps/api`. It uses disposable PGlite instances, existing test fixtures, and an in-memory cache. Remove the temporary file afterwards. After fixing the defects, invert these expectations into proper regression tests at the appropriate layers.

The count probe uses real persistence and managed-service code but a minimal authorization stub. The payment probe uses the existing finance workflow mock repository harness. Connection disposal and cache invalidation are focused unit probes. The sign-up check uses the actual Better Auth HTTP handler with production-mode auth settings; it is not a deployed Worker test.

```typescript
import { describe, expect, it } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { runMigrations } from '@edaya/adaptor-auth';
import { createBetterAuth } from '@/runtime/shared/adapters/better-auth';
import { attachAuthDatabase } from '@/runtime/shared/auth-database';
import { ManagedEntityService } from '../../../package/domain-service/src/services/entities/managed-entity-service';
import { directSchoolTenant } from '../../../package/domain-service/src/services/entities/entity-config/tenant';
import { PostgresStore } from '../../../package/adaptor-postgres/src/postgres-store';
import { apiAuthCacheInvalidationPort } from '@/lib/authorization/auth-cache-invalidation-port';
import { getActorScopeCacheStore, resetActorScopeCacheStore } from '@/lib/authorization/scope-cache/store';
import { createFinanceContext } from '../../../package/domain-service/tests/services/workflows/workflow-test-context';
import { PaymentMethod } from '@edaya/core';

describe('Isolated audit observations (assert current behavior, not desired behavior)', () => {
  it('seed header verifies a new user under production auth configuration', async () => {
    const pg = new PGlite();
    try {
      const db = drizzle(pg);
      await runMigrations(db, { driver: 'pglite' });
      const auth = createBetterAuth(db, {
        BETTER_AUTH_SECRET: 'isolated-audit-placeholder-secret-with-enough-length',
        BETTER_AUTH_URL: 'https://audit.invalid',
        NODE_ENV: 'production', LOG_LEVEL: 'silent',
        REQUIRE_EMAIL_VERIFICATION: true,
      });
      const response = await auth.handler(new Request('https://audit.invalid/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-edaya-seed-provision': '1' },
        body: JSON.stringify({ email: 'audit@example.invalid', name: 'Synthetic Audit', password: 'isolated-Audit-Password-735!' }),
      }));
      const body = await response.json() as any;
      expect(response.status).toBe(200);
      expect(body.user.emailVerified).toBe(true);
      console.log('AUDIT: production-config public signup + seed header -> emailVerified=true');
    } finally { await pg.close(); }
  });

  it('elevated count crosses tenants with empty or mixed-school filters', async () => {
    const pg = new PGlite();
    try {
      await pg.exec('CREATE TABLE audit_rows (id text PRIMARY KEY, school_id text NOT NULL)');
      const table = pgTable('audit_rows', { id: text('id').primaryKey(), schoolId: text('school_id').notNull() });
      const store = new PostgresStore(drizzle(pg), table, (v: any) => v, (v: any) => v);
      await store.save({ id: 'a', schoolId: 'school-a' });
      await store.save({ id: 'b', schoolId: 'school-b' });
      const service = new ManagedEntityService({
        actor: { kind: 'staff', schoolId: 'school-a', effectiveGrants: { isElevated: true } } as any,
        repositories: {} as any,
        config: {
          repository: store, tenant: directSchoolTenant(),
          read: { checkModule: async () => {}, checkAccess: async () => {} },
          write: {} as any,
        },
      });
      expect(await service.count({})).toBe(2);
      expect(await service.count({ schoolId: { $in: ['school-a', 'school-b'] } })).toBe(2);
      expect(await service.count({ schoolId: 'school-a' })).toBe(1);
      await expect(service.list({})).rejects.toThrow();
      console.log('AUDIT: actual PostgresStore/PGlite count returns both schools; list rejects mixed rows');
    } finally { await pg.close(); }
  });

  it('attached auth handle discards disposal ownership', async () => {
    let disposed = false;
    const attached = await attachAuthDatabase({ db: {}, sqlClient: null, dispose: async () => { disposed = true; } } as any, { databaseUrl: 'postgres://synthetic' });
    await attached.dispose();
    expect(disposed).toBe(false);
    console.log('AUDIT: attachAuthDatabase disposal does not dispose the supplied handle');
  });

  it('guardian scope invalidation leaves the actual portal cache populated', () => {
    resetActorScopeCacheStore();
    const store = getActorScopeCacheStore();
    store.set('audit-key', { actorScope: 'school-a:guardian:guardian-a', generation: store.getGeneration(), expiresAt: Date.now() + 300000, scope: { studentIds: ['student-a'], classGroupIds: [] } });
    apiAuthCacheInvalidationPort.invalidateForEvent({ kind: 'guardian-scope', schoolId: 'school-a', guardianId: 'guardian-a' });
    expect(store.get('audit-key')).toBeDefined();
    resetActorScopeCacheStore();
    console.log('AUDIT: guardian-scope event leaves guardian portal scope cache intact');
  });

  it('replaying an existing payment adds its amount to the fee balance again', async () => {
    const { service, mockRepos } = createFinanceContext();
    await service.financeWorkflow.recordPayment({ id: 'pay1', studentFeeId: 'sf1', amount: 400, paymentDate: new Date('2026-03-01T00:00:00Z'), method: PaymentMethod.Cash });
    const calls = (mockRepos.studentFees.save as any).mock.calls;
    expect(calls.at(-1)[0].paidAmount.amount).toBe(800);
    console.log('AUDIT: existing pay1 amount=400 replay changes paidAmount from 400 to 800 (existing workflow test harness)');
  });
});
```
