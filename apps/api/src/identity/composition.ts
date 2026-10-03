import type { Environment as ApiEnvironment } from "@/runtime/shared/env/schema";
import type { CreateIdentityRuntimeOptions, IdentityRuntime } from "./runtime";
import type { IdentityClient } from "./server";
import { parseEnv } from "./env";
import { attachedIdentityRuntime, createIdentityRuntime } from "./runtime";
import { createAccountDirectory } from "./directory";
import { verifyIdentityToken } from "./server";
import { accountRequiresPrivilegedTotp } from "@/lib/account-security-policy";
import type { ApiSchoolApplication } from "@/lib/school-api/application";

/** One lazy Account connection owned by the enclosing API runtime. */
export function composeIdentity(env: ApiEnvironment, school: () => Promise<ApiSchoolApplication>, options: Pick<CreateIdentityRuntimeOptions, "delivery"> = {}) {
  let pending: Promise<IdentityRuntime> | undefined;
  const resolve = () => pending ??= Promise.resolve(attachedIdentityRuntime(env) ?? createIdentityRuntime(parseEnv({
    ...env,
    BETTER_AUTH_URL: env.API_ORIGIN,
    FIRST_PARTY_API_ORIGINS: env.API_ORIGIN,
    RUNTIME: env.RUNTIME === "in-memory" ? "test" : env.RUNTIME,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? (env.NODE_ENV === "production" ? undefined : "local-account-secret-at-least-32-characters"),
  }, env.RUNTIME === "worker" ? "worker" : "local"), {
    ...options,
    privilegedPolicy: { async requiresTotp(accountId) {
      return env.REQUIRE_PRIVILEGED_TOTP === true && accountRequiresPrivilegedTotp((await school()).repositories, accountId);
    } },
  }));
  const client: IdentityClient = {
    directory: createAccountDirectory(resolve),
    async verifyAccessToken(token) {
      return verifyIdentityToken(token, { issuer: env.API_ORIGIN, audience: env.API_ORIGIN, jwks: (await resolve()).keys.jwks });
    },
  };
  return { resolve, client, async close() {
    if (pending)
      await (await pending).close();
  } };
}
