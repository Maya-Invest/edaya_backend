import {
  createIdentityClient,
  IDENTITY_JWKS_PATH,
  type IdentityClient,
} from "@maya-invest/edaya-identity-client";
import type { Environment } from "@/runtime/shared/env/schema";

function identityFetch(env: Environment): typeof fetch | undefined {
  if (!env.IDENTITY) {
    return undefined;
  }
  return env.IDENTITY.fetch.bind(env.IDENTITY);
}

export function createSchoolIdentityClient(env: Environment): IdentityClient {
  return createIdentityClient({
    issuer: env.IDENTITY_ISSUER,
    audience: env.API_ORIGIN,
    jwksUrl: new URL(IDENTITY_JWKS_PATH, env.IDENTITY_ISSUER).toString(),
    directoryBaseUrl: env.IDENTITY_DIRECTORY_URL,
    directorySecret: env.IDENTITY_DIRECTORY_SECRET,
    ...(identityFetch(env) ? { fetch: identityFetch(env) } : {}),
  });
}
