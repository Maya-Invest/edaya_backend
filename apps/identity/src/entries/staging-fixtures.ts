import { createAccountRepository, rows } from "@edaya/adaptor-account";
import { createHash, randomBytes } from "node:crypto";
import { sql as query } from "drizzle-orm";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { parseEnv } from "../env";
import { assertStagingFixtureTarget, provisionFixtureAccounts } from "../staging-fixtures";

async function main(): Promise<void> {
  const [target, manifest, sessionsFile] = process.argv.slice(2);
  if (target !== "staging" || !manifest)
    throw new Error("Usage: staging-fixtures.ts staging <accounts.json>");
  const databaseUrl = process.env.STAGING_AUTH_DATABASE_URL ?? "";
  assertStagingFixtureTarget(databaseUrl, process.env.STAGING_DATABASE_HOST ?? "");
  const input: unknown = JSON.parse(await readFile(manifest, "utf8"));
  const env = parseEnv({ ...process.env, AUTH_DATABASE_URL: databaseUrl, RUNTIME: "local", NODE_ENV: "production", LOG_LEVEL: "silent", BETTER_AUTH_URL: "https://staging.identity.api.edayaplus.com", FIRST_PARTY_API_ORIGINS: "https://staging.school.api.edayaplus.com", REQUIRE_EMAIL_VERIFICATION: "true", EMAIL_TRANSPORT: "log" }, "local");
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const count = await provisionFixtureAccounts(drizzle(sql), env, input);
    if (sessionsFile) {
      const { repository, db } = createAccountRepository(drizzle(sql));
      const credentials: Record<string, string> = {};
      const accounts = input as Array<{
        email: string;
      }>;
      await repository.transaction(async () => {
        for (const item of accounts) {
          const account = await repository.find("email", item.email.trim().toLowerCase());
          if (!account || account.status !== "active" || (await repository.security(account.id)).secret)
            throw new Error("Fixture account cannot receive a bootstrap session");
          const evidence = rows(await db.execute(query`SELECT id FROM identity.security_event WHERE account_id=${account.id} AND event='administrative_fixture_created' LIMIT 1`));
          if (!evidence.length)
            throw new Error("Refusing to authenticate a non-fixture Account");
          const token = randomBytes(32).toString("base64url");
          const now = Date.now();
          await repository.saveSession({ id: crypto.randomUUID(), digest: createHash("sha256").update(token).digest("hex"), accountId: account.id, primaryAt: now, method: "email", expiresAt: now + 3600000, securityVersion: account.securityVersion, generation: env.AUTH_PROVIDER_GENERATION });
          await repository.audit(account.id, "administrative_fixture_session", now);
          credentials[item.email.trim().toLowerCase()] = token;
        }
      });
      await writeFile(sessionsFile, JSON.stringify(credentials), { mode: 0o600 });
    }
    console.log(`Provisioned ${count} identity fixture accounts (no email sent).`);
  }
  finally {
    await sql.end({ timeout: 5 });
  }
}
if (import.meta.main) {
  main().catch(() => {
    console.error("Staging identity provisioning failed; check explicit target, manifest, and migrations.");
    process.exitCode = 1;
  });
}
