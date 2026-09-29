/** Local test entry point. Never included in a production entry or deployment. */
import { appendFileSync, closeSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { serve } from '@hono/node-server';
import app from '../../src/app';
import { loadLocalProcessEnv } from '../../src/env';
import { attachIdentityRuntime, createIdentityRuntime } from '../../src/runtime';

config({ path: resolve(import.meta.dirname, '../../.env'), override: false });
if (process.env.NODE_ENV !== 'test') throw new Error('The integration Identity entry requires NODE_ENV=test');
const mailbox = process.env.EDAYA_TEST_OTP_FILE;
if (!mailbox) throw new Error('EDAYA_TEST_OTP_FILE is required');
const env = loadLocalProcessEnv();
if (!['localhost', '127.0.0.1'].includes(new URL(env.BETTER_AUTH_URL).hostname))
  throw new Error('Integration Identity must use loopback');
if (env.AUTH_DATABASE_URL && !['localhost', '127.0.0.1'].includes(new URL(env.AUTH_DATABASE_URL).hostname))
  throw new Error('Integration Identity requires a local test database');
closeSync(openSync(mailbox, 'w', 0o600));
const clockFile = process.env.EDAYA_TEST_CLOCK_FILE;
if (clockFile) writeFileSync(clockFile, '0', { mode: 0o600 });
const policyFile = process.env.EDAYA_TEST_POLICY_FILE;
if (policyFile) writeFileSync(policyFile, '[]', { mode: 0o600 });
const runtime = await createIdentityRuntime(env, {
  privilegedPolicy: policyFile ? {
    async requiresTotp(accountId) {
      const accounts: unknown = JSON.parse(readFileSync(policyFile, 'utf8'));
      if (!Array.isArray(accounts) || accounts.some(value => typeof value !== 'string')) throw new Error('Invalid integration policy fixture');
      return accounts.includes(accountId);
    },
  } : undefined,
  now: clockFile ? () => {
    const offset = Number(readFileSync(clockFile, 'utf8'));
    if (!Number.isFinite(offset)) throw new Error('Invalid integration clock offset');
    return Date.now() + offset;
  } : undefined,
  delivery: {
    async send(message) {
      // Credentials stay in a private local mailbox, never application logs or QA artifacts.
      appendFileSync(mailbox, `${JSON.stringify({ ...message, deliveredAt: Date.now() })}\n`, { mode: 0o600 });
    },
  },
});
attachIdentityRuntime(env, runtime);
const server = serve({ hostname: '127.0.0.1', port: env.PORT, fetch: request => app.fetch(request, env) });
process.once('SIGTERM', () => server.close(() => { void runtime.close().then(() => process.exit(0)); }));
console.log(`Integration Identity listening on loopback:${env.PORT}`);
