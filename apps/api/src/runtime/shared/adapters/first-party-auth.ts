import type { AccessSession, createAccessTokenStore, createDelegationGrantStore } from "@edaya/adaptor-auth";
import type { BetterAuthEnv } from "./better-auth";

interface Provider {
  handler: (request: Request) => Promise<Response>;
  api: { getSession: (args: { headers: Headers }) => Promise<unknown> };
}

const browserPaths = new Set([
  "/sign-up/email",
  "/sign-in/email",
  "/sign-in/email-otp",
  "/sign-out",
  "/get-session",
  "/email-otp/send-verification-otp",
  "/email-otp/verify-email",
  "/verify-email",
  "/send-verification-email",
  "/request-password-reset",
  "/reset-password",
  "/open-api/generate-schema",
]);

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", ...(status === 401 ? { "www-authenticate": "Bearer" } : {}) },
  });
}

function session(value: unknown): AccessSession | null {
  if (!value || typeof value !== "object" || !("session" in value) || !("user" in value)) {
    return null;
  }
  const result = value as AccessSession;
  return result.session?.id && result.user?.id ? result : null;
}

/** Keep long-lived provider credentials inside the authentication boundary. */
export function createFirstPartyAuthFacade(provider: Provider, tokens: ReturnType<typeof createAccessTokenStore>, env: BetterAuthEnv, grants?: ReturnType<typeof createDelegationGrantStore>) {
  function trustedOrigin(request: Request): boolean {
    const origin = request.headers.get("origin");
    const allowed = [new URL(env.BETTER_AUTH_URL).origin, ...(env.TRUSTED_ORIGINS?.split(",").map(value => value.trim()) ?? [])];
    return origin !== null && allowed.includes(origin);
  }

  async function renewalSession(request: Request): Promise<AccessSession | null> {
    const headers = new Headers(request.headers);
    if (headers.has("authorization")) {
      headers.delete("cookie");
      if (!/^Bearer \S+$/i.test(headers.get("authorization") ?? "")) {
        return null;
      }
    }
    else if (!trustedOrigin(request) || !request.headers.get("content-type")?.startsWith("application/json")) {
      return null;
    }
    return session(await provider.api.getSession({ headers }));
  }

  async function getBusinessSession({ headers }: { headers: Headers }): Promise<AccessSession | null> {
    const authorization = headers.get("authorization");
    if (authorization !== null) {
      const match = /^Bearer (edaya_at_[\w-]{43})$/i.exec(authorization);
      return match ? tokens.resolve(match[1]!) : null;
    }
    return env.ALLOW_LEGACY_COOKIE_BUSINESS_AUTH ? session(await provider.api.getSession({ headers })) : null;
  }

  async function handler(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname.replace(/^\/auth/, "");
    if (request.method === "POST") {
      // Cloudflare overwrites this header at ingress. Local/test instances share
      // a conservative bucket rather than trusting caller-supplied proxy headers.
      const remote = env.RUNTIME === "worker" ? request.headers.get("cf-connecting-ip") ?? "unknown" : "local";
      // Synthetic test fixtures provision hundreds of accounts in one minute.
      // This limit is never relaxed on a Worker, including a test-labelled Worker.
      const maximum = env.NODE_ENV === "test" && env.RUNTIME !== "worker" ? 10000 : 120;
      if (!await tokens.takeQuota(`auth:${remote}`, maximum)) {
        const response = json({ message: "Too many authentication requests" }, 429);
        response.headers.set("Retry-After", "60");
        return response;
      }
    }
    if (path === "/edaya/connected-apps" || /^\/edaya\/connected-apps\/[^/]+\/revoke$/.test(path)) {
      // Management accepts only a first-party access token, including during a
      // temporary legacy-cookie rollback. Ambient cookies never grant authority.
      const match = /^Bearer (edaya_at_[\w-]{43})$/i.exec(request.headers.get("authorization") ?? "");
      const active = match ? await tokens.resolve(match[1]!) : null;
      if (!active) {
        return json({ message: "A first-party access token is required" }, 401);
      }
      if (!grants) {
        return json({ message: "Connected apps are unavailable" }, 503);
      }
      if (path === "/edaya/connected-apps" && request.method === "GET") {
        const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
        if (cursor && !/^[\w-]{1,100}$/.test(cursor)) {
          return json({ message: "Invalid cursor" }, 400);
        }
        return json(await grants.listForSubject(active.user.id, cursor));
      }
      if (path.endsWith("/revoke") && request.method === "POST") {
        const id = path.split("/")[3]!;
        // The ownership predicate and revocation are one durable statement.
        const revoked = await grants.revoke(id, active.user.id);
        return revoked ? json({ success: true }) : json({ message: "Connected app not found" }, 404);
      }
      return json({ message: "Method not allowed" }, 405);
    }
    if (path === "/edaya/session" && request.method === "POST") {
      const active = await renewalSession(request);
      return active
        ? json({
            user: active.user,
            session: { id: active.session.id, userId: active.user.id, expiresAt: active.session.expiresAt },
          })
        : json({ message: "An active renewal session is required" }, 401);
    }
    if (path === "/edaya/access-token" && request.method === "POST") {
      const active = await renewalSession(request);
      if (!active) {
        return json({ message: "An active renewal session is required" }, 401);
      }
      if (!await tokens.takeQuota(`exchange:${active.session.id}`, 30)) {
        const response = json({ message: "Too many token exchanges" }, 429);
        response.headers.set("Retry-After", "60");
        return response;
      }
      const issued = await tokens.issue(active.session.id);
      return issued ? json(issued) : json({ message: "Session expired" }, 401);
    }
    if (path.startsWith("/edaya/native/sign-in/") && request.method === "POST") {
      const method = path.slice("/edaya/native/sign-in/".length);
      if (method !== "email" && method !== "email-otp") {
        return json({ message: "Unsupported login method" }, 404);
      }
      // Login proof comes from the password/OTP body, never an existing cookie.
      const headers = new Headers(request.headers);
      headers.delete("cookie");
      headers.delete("authorization");
      const response = await provider.handler(new Request(new URL(`/auth/sign-in/${method}`, env.BETTER_AUTH_URL), {
        method: "POST",
        headers,
        body: await request.text(),
      }));
      if (!response.ok) {
        return sanitizeBrowserResponse(response);
      }
      const renewalCredential = response.headers.get("set-auth-token");
      if (!renewalCredential) {
        return json({ message: "Login did not establish a renewal session" }, 401);
      }
      const active = session(await provider.api.getSession({ headers: new Headers({ authorization: `Bearer ${renewalCredential}` }) }));
      if (!active) {
        return json({ message: "Login session is unavailable" }, 401);
      }
      return json({ renewalCredential, renewalExpiresAt: new Date(active.session.expiresAt).toISOString(), user: active.user });
    }
    if ((path === "/edaya/sign-out" || path === "/edaya/sign-out-all") && request.method === "POST") {
      const active = request.headers.has("authorization")
        ? await getBusinessSession({ headers: request.headers }) ?? await renewalSession(request)
        : await renewalSession(request);
      if (!active) {
        return json({ message: "An active session is required" }, 401);
      }
      if (path.endsWith("sign-out-all")) {
        if (Date.now() - new Date(active.session.createdAt).getTime() > 5 * 60 * 1000) {
          return json({ message: "Sign in again before signing out all sessions", code: "REAUTHENTICATION_REQUIRED" }, 401);
        }
        await tokens.revokeSubjectSessions(active.user.id);
      }
      else {
        await tokens.revokeSession(active.session.id);
      }
      if (request.headers.has("authorization")) {
        return json({ success: true });
      }
      const headers = new Headers(request.headers);
      headers.delete("authorization");
      headers.set("content-type", "application/json");
      const response = await provider.handler(new Request(new URL("/auth/sign-out", env.BETTER_AUTH_URL), { method: "POST", headers, body: "{}" }));
      return sanitizeBrowserResponse(response);
    }
    if (!browserPaths.has(path)) {
      return json({ message: "Auth endpoint not found" }, 404);
    }
    if (request.headers.has("authorization")) {
      return json({ message: "Use the Edaya authentication endpoint" }, 401);
    }
    return sanitizeBrowserResponse(await provider.handler(request));
  }

  return { handler, getBusinessSession };
}

async function sanitizeBrowserResponse(response: Response): Promise<Response> {
  const headers = new Headers(response.headers);
  headers.delete("set-auth-token");
  headers.delete("access-control-expose-headers");
  headers.set("cache-control", "no-store");
  if (!headers.get("content-type")?.includes("application/json")) {
    return new Response(response.body, { status: response.status, headers });
  }
  const body = await response.json();
  if (body && typeof body === "object") {
    const data = body as Record<string, unknown>;
    delete data.token;
    if (data.session && typeof data.session === "object") {
      delete (data.session as Record<string, unknown>).token;
    }
  }
  headers.delete("content-length");
  return new Response(JSON.stringify(body), { status: response.status, headers });
}
