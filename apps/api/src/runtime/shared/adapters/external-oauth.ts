import type { DelegationGrant } from "@edaya/adaptor-auth";
import type { BetterAuthEnv } from "./better-auth";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { oauthProvider } from "@better-auth/oauth-provider";
import {
  createAccessTokenStore,
  createAuthTransactions,
  createDelegationGrantStore,
  EXTERNAL_ACCESS_PREFIX,
  EXTERNAL_REFRESH_PREFIX,
  hashOAuthToken,
} from "@edaya/adaptor-auth";
import { AuthorizationError } from "@edaya/authorization";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { jwt } from "better-auth/plugins";
import { externalOAuthScopes } from "@/lib/integrations/scopes";
import { buildBetterAuthConfig } from "./better-auth";

export interface DelegationSelection {
  schoolId: string;
  studentIds: string[];
  scopes: string[];
}

export interface DelegationAuthorization {
  /** Re-resolve a guardian actor and exact selected children in the school DB. */
  authorizeSelection: (subjectId: string, selection: DelegationSelection) => Promise<{ guardianId: string }>;
  /** Recheck current subject, guardian, school and at least one selected link. */
  isGrantCurrent: (grant: DelegationGrant) => Promise<boolean>;
}

class ProtocolRollback extends Error {
  constructor(readonly response: Response) {
    super("OAuth transaction did not complete");
  }
}

function invalidGrant() {
  return Response.json({ error: "invalid_grant" }, { status: 400, headers: { "cache-control": "no-store" } });
}

/** Internal protocol boundary. HTTP mounting must supply school authorization. */
export function createExternalOAuthProvider(database: unknown, env: BetterAuthEnv, authorization: DelegationAuthorization) {
  const transactions = createAuthTransactions(database);
  const grants = createDelegationGrantStore(transactions.db);
  const quota = createAccessTokenStore(database);
  const silentAuthorization = new AsyncLocalStorage<boolean>();
  const consentContext = new AsyncLocalStorage<DelegationGrant>();
  const webOrigin = env.WEBAPP_ORIGIN ?? new URL(env.BETTER_AUTH_URL).origin;
  const base = buildBetterAuthConfig(transactions.db, env);
  const provider = betterAuth({
    ...base,
    disabledPaths: ["/token"],
    plugins: [
      ...(base.plugins ?? []),
      jwt(),
      oauthProvider({
        loginPage: `${webOrigin}/login`,
        consentPage: `${webOrigin}/authorize`,
        scopes: externalOAuthScopes,
        grantTypes: ["authorization_code", "refresh_token"],
        allowDynamicClientRegistration: false,
        clientPrivileges: () => false,
        resourcePrivileges: () => false,
        accessTokenExpiresIn: 300,
        idTokenExpiresIn: 300,
        refreshTokenExpiresIn: 30 * 24 * 60 * 60,
        refreshTokenReuseInterval: 0,
        codeExpiresIn: 60,
        prefix: { opaqueAccessToken: EXTERNAL_ACCESS_PREFIX, refreshToken: EXTERNAL_REFRESH_PREFIX },
        storeTokens: { hash: hashOAuthToken },
        storeClientSecret: { hash: hashOAuthToken },
        generateOpaqueAccessToken: () => randomBytes(32).toString("base64url"),
        postLogin: {
          page: `${webOrigin}/authorize`,
          // Let the provider validate the client/redirect and return the OIDC
          // interaction-required error for silent requests, without reusing consent.
          shouldRedirect: () => silentAuthorization.getStore() ?? false,
          consentReferenceId: ({ user, scopes }) => {
            const grant = consentContext.getStore();
            if (!grant || grant.subjectId !== user?.id || scopes.length !== grant.scopes.length || scopes.some(scope => !grant.scopes.includes(scope))) {
              throw new APIError("FORBIDDEN", { message: "Explicit Edaya parent consent is required" });
            }
            return grant.id;
          },
        },
      }),
    ],
  });

  async function atomicResponse(work: () => Promise<Response>, rollbackClientError = false): Promise<Response> {
    try {
      return await transactions.execute(async () => {
        const response = await work();
        if (response.status >= 500 || (rollbackClientError && response.status >= 400)) {
          throw new ProtocolRollback(response);
        }
        response.headers.set("cache-control", "no-store");
        return response;
      });
    }
    catch (error) {
      if (error instanceof ProtocolRollback) {
        return error.response;
      }
      throw error;
    }
  }

  function protocolError(error: string, status = 400): Response {
    return Response.json({ error }, { status, headers: { "cache-control": "no-store", ...(status === 401 ? { "www-authenticate": "Bearer" } : {}) } });
  }

  function hostedRequest(request: Request): boolean {
    const allowed = [new URL(env.BETTER_AUTH_URL).origin, ...(env.TRUSTED_ORIGINS?.split(",").map(value => value.trim()) ?? [])];
    return !request.headers.has("authorization") && request.headers.has("cookie")
      && allowed.includes(request.headers.get("origin") ?? "")
      && request.headers.get("content-type")?.split(";")[0]?.trim() === "application/json";
  }

  async function admitted(request: Request): Promise<boolean> {
    const remote = env.RUNTIME === "worker" ? request.headers.get("cf-connecting-ip") ?? "unknown" : "local";
    return quota.takeQuota(`oauth:${remote}`, env.NODE_ENV === "test" && env.RUNTIME !== "worker" ? 10000 : 120);
  }

  function limited(): Response {
    const response = protocolError("temporarily_unavailable", 429);
    response.headers.set("retry-after", "60");
    return response;
  }

  async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const discovery = ["/auth/.well-known/openid-configuration", "/auth/.well-known/oauth-authorization-server"].includes(url.pathname);
    if ((discovery || url.pathname === "/auth/jwks") && request.method === "GET") {
      const response = await provider.handler(request);
      if (!response.ok || !discovery) {
        return response;
      }
      const metadata = await response.json() as Record<string, unknown>;
      // Advertise only the protocol features admitted by this boundary.
      delete metadata.introspection_endpoint;
      delete metadata.introspection_endpoint_auth_methods_supported;
      delete metadata.end_session_endpoint;
      delete metadata.registration_endpoint;
      metadata.token_endpoint_auth_methods_supported = ["none", "client_secret_basic"];
      metadata.revocation_endpoint_auth_methods_supported = ["none", "client_secret_basic"];
      if (url.pathname.endsWith("openid-configuration")) {
        metadata.claims_supported = ["sub", "iss", "aud", "exp", "iat", "nonce", "auth_time", "acr", "at_hash"];
        metadata.claims_parameter_supported = false;
        metadata.prompt_values_supported = ["login", "consent", "none"];
      }
      return Response.json(metadata, { headers: { "cache-control": "public, max-age=60" } });
    }
    if (url.pathname === "/auth/oauth2/userinfo" && request.method === "GET") {
      if (!await admitted(request)) {
        return limited();
      }
      const bearer = /^Bearer (edaya_oat_[\w-]{43})$/i.exec(request.headers.get("authorization") ?? "");
      const grant = bearer ? await grants.findTokenGrant(bearer[1]!, "access") : null;
      if (!grant || !await authorization.isGrantCurrent(grant)) {
        return protocolError("invalid_token", 401);
      }
      if (!grant.scopes.includes("openid")) {
        return protocolError("insufficient_scope", 403);
      }
      const headers = new Headers({ authorization: `Bearer ${bearer![1]}` });
      const response = await provider.handler(new Request(url, { headers }));
      if (!response.ok) {
        return response;
      }
      const identity = await response.json() as { sub: string };
      return Response.json({ sub: identity.sub }, { headers: { "cache-control": "no-store" } });
    }
    if (url.pathname === "/auth/oauth2/authorize" && request.method === "GET") {
      if (!await admitted(request)) {
        return limited();
      }
      if (request.headers.has("authorization") || url.searchParams.has("claims") || url.searchParams.has("resource")
        || [...url.searchParams.keys()].some(key => url.searchParams.getAll(key).length !== 1)) {
        return protocolError("invalid_request");
      }
      const prompts = new Set((url.searchParams.get("prompt") ?? "").split(/\s+/).filter(Boolean));
      if ([...prompts].some(prompt => !["login", "consent", "none"].includes(prompt)) || (prompts.has("none") && prompts.size > 1)) {
        return protocolError("invalid_request");
      }
      const silent = prompts.has("none");
      if (!silent) {
        // Preserve login requirements while forcing an explicit child selection.
        prompts.add("consent");
        url.searchParams.set("prompt", [...prompts].join(" "));
      }
      return silentAuthorization.run(silent, () => atomicResponse(() => provider.handler(new Request(url, request))));
    }
    if (url.pathname !== "/auth/oauth2/token" && url.pathname !== "/auth/oauth2/revoke") {
      return new Response(null, { status: 404 });
    }
    if (request.method !== "POST") {
      return new Response(null, { status: 405 });
    }
    if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/x-www-form-urlencoded") {
      return protocolError("invalid_request");
    }
    if (!await admitted(request)) {
      return limited();
    }
    const body = await request.text();
    if (body.length > 16384) {
      return protocolError("invalid_request", 413);
    }
    const form = new URLSearchParams(body);
    if ([...form.keys()].some(key => form.getAll(key).length !== 1) || form.has("resource")) {
      return protocolError("invalid_request");
    }
    const headers = new Headers(request.headers);
    headers.delete("cookie");
    const protocolRequest = new Request(url, { method: "POST", headers, body });
    return atomicResponse(async () => {
      if (form.get("grant_type") === "refresh_token") {
        const grant = await grants.findTokenGrant(form.get("refresh_token") ?? "", "refresh");
        if (!grant || !await authorization.isGrantCurrent(grant)) {
          return invalidGrant();
        }
      }
      const response = await provider.handler(protocolRequest);
      if (response.ok && url.pathname.endsWith("/token")) {
        const body = await response.clone().json() as { access_token?: string; expires_in: number; expires_at: number; scope: string };
        const grant = body.access_token ? await grants.findTokenGrant(body.access_token, "access") : null;
        if (!grant || !await authorization.isGrantCurrent(grant)) {
          throw new ProtocolRollback(invalidGrant());
        }
        await grants.capTokenLifetimes(grant.id);
        body.expires_at = Math.min(body.expires_at, Math.floor(grant.expiresAt.getTime() / 1000));
        body.expires_in = Math.max(0, Math.min(body.expires_in, body.expires_at - Math.floor(Date.now() / 1000)));
        body.scope = grant.scopes.join(" ");
        const headers = new Headers(response.headers);
        headers.delete("content-length");
        return Response.json(body, { status: response.status, headers });
      }
      // A protocol 400 may record refresh-family replay revocation: commit it.
      return response;
    });
  }

  async function consent(request: Request, selection: DelegationSelection): Promise<Response> {
    if (new URL(request.url).pathname !== "/auth/oauth2/consent" || request.method !== "POST") {
      return protocolError("invalid_request");
    }
    if (!hostedRequest(request)) {
      return protocolError("access_denied", 403);
    }
    if (!await admitted(request)) {
      return limited();
    }
    const text = await request.clone().text();
    if (text.length > 16384) {
      return protocolError("invalid_request", 413);
    }
    let body: { oauth_query?: string; accept?: boolean };
    try {
      body = JSON.parse(text);
    }
    catch {
      return protocolError("invalid_request");
    }
    if (!body || typeof body.oauth_query !== "string" || typeof body.accept !== "boolean") {
      return protocolError("invalid_request");
    }
    return atomicResponse(async () => {
      const active = await provider.api.getSession({ headers: request.headers });
      if (!active) {
        return new Response(null, { status: 401 });
      }
      if (!body.accept) {
        return provider.handler(request);
      }
      const query = new URLSearchParams(body.oauth_query);
      const clientId = query.get("client_id");
      const requested = query.get("scope")?.split(" ") ?? [];
      if (!clientId || typeof selection?.schoolId !== "string" || !selection.schoolId
        || !Array.isArray(selection.scopes) || !Array.isArray(selection.studentIds)
        || !selection.scopes.length || !selection.studentIds.length || selection.studentIds.length > 100
        || selection.studentIds.some(id => typeof id !== "string" || !id || id.length > 200)
        || new Set(selection.studentIds).size !== selection.studentIds.length || new Set(selection.scopes).size !== selection.scopes.length
        || selection.scopes.some(scope => !requested.includes(scope) || !externalOAuthScopes.includes(scope))) {
        return invalidGrant();
      }
      let guardianId: string;
      try {
        ({ guardianId } = await authorization.authorizeSelection(active.user.id, selection));
      }
      catch (error) {
        if (error instanceof AuthorizationError) {
          return protocolError("access_denied", 403);
        }
        throw error;
      }
      const grant = await grants.create({ ...selection, subjectId: active.user.id, clientId, guardianId });
      const headers = new Headers(request.headers);
      headers.set("content-type", "application/json");
      // Ignore caller reference IDs and accepted scope fields. The provider
      // verifies its signed query before binding our server-created grant.
      const consentRequest = new Request(new URL("/auth/oauth2/consent", env.BETTER_AUTH_URL), {
        method: "POST",
        headers,
        body: JSON.stringify({ oauth_query: body.oauth_query, accept: true, scope: selection.scopes.join(" "), claims: {} }),
      });
      return consentContext.run(grant, () => provider.handler(consentRequest));
    }, true);
  }

  return { handler, consent, grants, transactions };
}
