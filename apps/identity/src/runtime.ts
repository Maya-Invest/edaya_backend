import type { Environment } from "./env";
import type { IdentitySigningKeys } from "./jwt-keys";
import type { OtpDeliveryPort, PrivilegedAccountPolicyPort } from "@edaya/account";
import { AccountService } from "@edaya/account";
import { createAccountRepository, createAccountSecurity } from "@edaya/adaptor-account";
import { createBetterAuthAdapter } from "@edaya/adaptor-auth-better-auth";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { createAccountAuthHandler } from "./account-auth";
import { createOtpDelivery } from "./otp-delivery";
import { createAuthDatabase } from "./database";
import { ensureIdentitySigningKeys } from "./jwt-keys";

export interface IdentityRuntime {
  env: Environment;
  db: unknown;
  keys: IdentitySigningKeys;
  accounts: AccountService;
  auth: {
    handler: (request: Request) => Promise<Response>;
    purgeExpiredCredentials: () => Promise<void>;
  };
  close: () => Promise<void>;
}
export interface CreateIdentityRuntimeOptions {
  keys?: IdentitySigningKeys;
  /** Integration tests capture delivery here while retaining the real provider. */
  delivery?: OtpDeliveryPort;
  /** Account expiration tests can advance time without waiting in real time. */
  now?: () => number;
  /** Test composition can enforce policy for isolated fixture accounts. */
  privilegedPolicy?: PrivilegedAccountPolicyPort;
}
const attached = new WeakMap<object, IdentityRuntime | Promise<IdentityRuntime>>();
export function attachIdentityRuntime(env: object, runtime: IdentityRuntime): void {
  attached.set(env, runtime);
}
export async function resolveIdentityRuntime(env: Environment): Promise<IdentityRuntime> {
  const existing = attached.get(env);
  if (existing) {
    return existing;
  }
  const created = createIdentityRuntime(env);
  attached.set(env, created);
  const runtime = await created;
  attached.set(env, runtime);
  return runtime;
}
export async function createIdentityRuntime(env: Environment, options: CreateIdentityRuntimeOptions = {}): Promise<IdentityRuntime> {
  const handle = await createAuthDatabase(env);
  try {
    const keys = options.keys ?? await ensureIdentitySigningKeys(handle.db);
    const { repository, db } = createAccountRepository(handle.db);
    if (env.NODE_ENV === "production" && !env.ACCOUNT_SECURITY_KEYS)
      throw new Error("ACCOUNT_SECURITY_KEYS is required in production");
    const keyring = env.ACCOUNT_SECURITY_KEYS
      ? JSON.parse(env.ACCOUNT_SECURITY_KEYS) as Record<string, string>
      : { v1: createHash("sha256").update(`local-account-key:${env.BETTER_AUTH_SECRET}`).digest("base64") };
    const security = createAccountSecurity(keyring, env.ACCOUNT_SECURITY_KEY_VERSION);
    const provider = createBetterAuthAdapter(db, { secret: env.BETTER_AUTH_SECRET, baseUrl: env.BETTER_AUTH_URL, generation: env.AUTH_PROVIDER_GENERATION, delivery: options.delivery ?? createOtpDelivery(env) });
    const accounts = new AccountService(repository, provider, security, options.privilegedPolicy ?? { async requiresTotp(accountId) {
      if (!env.REQUIRE_PRIVILEGED_TOTP)
        return false;
      if (!env.ACCOUNT_POLICY_URL)
        throw new Error("ACCOUNT_POLICY_URL is required when privileged MFA is enabled");
      const response = await fetch(new URL(`/internal/account-policy/${encodeURIComponent(accountId)}`, env.ACCOUNT_POLICY_URL), {
        headers: { "x-edaya-directory-secret": env.IDENTITY_DIRECTORY_SECRET },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok)
        throw new Error("Account security policy unavailable");
      const result = await response.json() as {
        requiresTotp?: unknown;
      };
      if (typeof result.requiresTotp !== "boolean")
        throw new Error("Invalid account security policy");
      return result.requiresTotp;
    } }, options.now ?? Date.now, env.RUNTIME !== "worker" && env.NODE_ENV !== "production" && (env.NODE_ENV === "test" || env.AUTH_DEV_OTP_PEEK === true));
    const auth = {
      handler: createAccountAuthHandler(accounts, env, keys),
      async purgeExpiredCredentials() {
        const now = Date.now();
        for (const table of ["session", "challenge", "pending", "quota"])
          await db.execute(sql`DELETE FROM ${sql.identifier("identity")}.${sql.identifier(table)} WHERE expires_at<=${now}`);
      },
    };
    return {
      env,
      db: handle.db,
      keys,
      auth,
      accounts,
      close: () => handle.dispose(),
    };
  }
  catch (error) {
    await handle.dispose();
    throw error;
  }
}
