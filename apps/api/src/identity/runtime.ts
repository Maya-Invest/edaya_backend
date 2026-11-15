import type { OtpDeliveryPort, PrivilegedAccountPolicyPort } from "@edaya/account";
import type { SmsRouterPort } from "@edaya/core";
import type { Environment } from "./env";
import type { IdentitySigningKeys } from "./jwt-keys";
import { createHash } from "node:crypto";
import { AccountService } from "@edaya/account";
import { createAccountRepository, createAccountSecurity, teacherQuickCodes } from "@edaya/adaptor-account";
import { createBetterAuthAdapter } from "@edaya/adaptor-auth-better-auth";
import { sql } from "drizzle-orm";
import { resolveSmsRouter } from "@/runtime/shared/adapters/sms-router";
import { createAccountAuthHandler } from "./account-auth";
import { createAuthDatabase } from "./database";
import { ensureIdentitySigningKeys } from "./jwt-keys";
import { createOtpDelivery } from "./otp-delivery";
import { createTermsPolicy } from "./terms-policy";

export interface IdentityRuntime {
  env: Environment;
  db: unknown;
  keys: IdentitySigningKeys;
  accounts: AccountService;
  smsRouter: SmsRouterPort;
  quickCodes: ReturnType<typeof teacherQuickCodes>;
  accountById: ReturnType<typeof createAccountRepository>["repository"]["get"];
  auth: {
    handler: (request: Request) => Promise<Response>;
    purgeExpiredCredentials: () => Promise<void>;
  };
  close: () => Promise<void>;
}
export interface CreateIdentityRuntimeOptions {
  keys?: IdentitySigningKeys;
  teacherEligible?: (scope: { teacherId: string; schoolId: string }, accountId: string) => Promise<boolean>;
  /** Explicit local capture composition only; never inferred for Workers. */
  localFixtures?: boolean;
  /** Integration tests capture delivery here while retaining the real provider. */
  delivery?: OtpDeliveryPort;
  smsRouter?: SmsRouterPort;
  /** Account expiration tests can advance time without waiting in real time. */
  now?: () => number;
  /** Test composition can enforce policy for isolated fixture accounts. */
  invitedEmail?: (email: string, tokenHash?: string) => Promise<string | undefined>;
  privilegedPolicy?: PrivilegedAccountPolicyPort;
}
const attached = new WeakMap<object, IdentityRuntime | Promise<IdentityRuntime>>();
export function attachIdentityRuntime(env: object, runtime: IdentityRuntime): void {
  attached.set(env, runtime);
}
export function attachedIdentityRuntime(env: object) {
  return attached.get(env);
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
    const { repository, db } = createAccountRepository(handle.db, options.now);
    if (env.NODE_ENV === "production" && !env.ACCOUNT_SECURITY_KEYS)
      throw new Error("ACCOUNT_SECURITY_KEYS is required in production");
    const keyring = env.ACCOUNT_SECURITY_KEYS
      ? JSON.parse(env.ACCOUNT_SECURITY_KEYS) as Record<string, string>
      : { v1: createHash("sha256").update(`local-account-key:${env.BETTER_AUTH_SECRET}`).digest("base64") };
    const security = createAccountSecurity(keyring, env.ACCOUNT_SECURITY_KEY_VERSION);
    const smsRouter = options.smsRouter ?? resolveSmsRouter(env);
    const delivery = options.delivery ?? createOtpDelivery(env, fetch, smsRouter);
    const provider = createBetterAuthAdapter(db, { secret: env.BETTER_AUTH_SECRET, baseUrl: env.BETTER_AUTH_URL, generation: env.AUTH_PROVIDER_GENERATION, delivery });
    const quickCodes = teacherQuickCodes(db, env.BETTER_AUTH_SECRET);
    const accounts = new AccountService(repository, provider, security, options.privilegedPolicy ?? { async requiresTotp(_accountId) {
      if (!env.REQUIRE_PRIVILEGED_TOTP)
        return false;
      throw new Error("Privileged Account policy must be composed in-process");
    } }, options.now ?? Date.now, env.RUNTIME !== "worker" && env.NODE_ENV !== "production" && (env.NODE_ENV === "test" || options.localFixtures === true), { mode: env.PHONE_AUTH_MODE, supports: phone => /^\+225(?:01|05|07)\d{8}$/.test(phone) && smsRouter.supports(phone), delivery }, createTermsPolicy(env), async (email, hash) => {
      if (env.ALLOW_PUBLIC_ACCOUNT_REGISTRATION === true)
        return { eligible: true };
      const invitationHash = await options.invitedEmail?.(email, hash);
      return { eligible: !!invitationHash, invitationHash };
    }, { lookup: quickCodes.lookup, eligible: options.teacherEligible ?? (async () => false) });
    const auth = {
      handler: createAccountAuthHandler(accounts, env, keys),
      async purgeExpiredCredentials() {
        const now = (options.now ?? Date.now)();
        for (const table of ["session", "pending", "quota", "otp_cooldown", "otp_request", "otp_receipt"])
          await db.execute(sql`DELETE FROM ${sql.identifier("identity")}.${sql.identifier(table)} WHERE expires_at<=${now}`);
        await db.execute(sql`DELETE FROM identity.challenge WHERE expires_at<=${now - 3600000}`);
      },
    };
    return {
      env,
      db: handle.db,
      keys,
      auth,
      accounts,
      quickCodes,
      smsRouter,
      accountById: repository.get,
      close: () => handle.dispose(),
    };
  }
  catch (error) {
    await handle.dispose();
    throw error;
  }
}
