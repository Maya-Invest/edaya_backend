import type { Account, AccountService, AuthOutcome, AuthSession } from "@edaya/account";
import type { Environment } from "./env";
import type { IdentitySigningKeys } from "./jwt-keys";
import { AuthError } from "@edaya/account";
import { z } from "zod";
import { getLastAuthOtpForTests, isDevOtpPeekEnabled } from "./email";
import { resolveAllowlistedApiOrigin } from "./env";
import { signIdentityAccessToken } from "./jwt-keys";

const startSchema = z.object({ kind: z.enum(["email", "phone"]), value: z.string().max(254), channel: z.enum(["email", "telegram", "whatsapp"]), recoveryEligible: z.boolean().optional() }).strict();
const verifySchema = z.object({ challenge: z.string().min(1).max(128), code: z.string().max(128) }).strict();
const enrollmentSchema = z.object({ challenge: z.string().max(128).optional() }).strict();
const tokenSchema = z.object({ resource: z.string().url() }).strict();
export function accountUser(account: Account) {
  const email = account.identifiers.find(i => i.kind === "email")?.value;
  const phone = account.identifiers.find(i => i.kind === "phone")?.value;
  return { id: account.id, accountId: account.id, name: account.name, email: email ?? null, phone: phone ?? null, emailVerified: !!email, phoneVerified: !!phone, createdAt: new Date(account.createdAt).toISOString() };
}
function sessionDto(session: AuthSession) {
  return { id: session.id, userId: session.accountId, accountId: session.accountId, createdAt: new Date(session.primaryAt).toISOString(), expiresAt: new Date(session.expiresAt).toISOString(), secondFactorAt: session.secondAt ? new Date(session.secondAt).toISOString() : null };
}
export function createAccountAuthHandler(service: AccountService, env: Environment, keys: IdentitySigningKeys) {
  const secure = new URL(env.BETTER_AUTH_URL).protocol === "https:";
  const cookieName = secure ? "__Host-edaya_session" : "edaya_session";
  const cookie = (value: string, maxAge: number) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
  function json(value: unknown, status = 200, extra: Record<string, string> = {}) {
    return Response.json(value, { status, headers: { "cache-control": "no-store", ...extra } });
  }
  function credential(request: Request) {
    const bearer = request.headers.get("authorization")?.match(/^Bearer ([\w-]+)$/)?.[1];
    if (bearer)
      return bearer;
    return request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? "";
  }
  function outcome(result: AuthOutcome | {
    state: "linked";
    account: Account;
  }, request: Request) {
    if (result.state !== "complete")
      return json(result);
    const recoveryCodes = "recoveryCodes" in result ? result.recoveryCodes : undefined;
    return json({ state: "complete", account: result.account, user: accountUser(result.account), session: sessionDto(result.session), ...(recoveryCodes ? { recoveryCodes } : {}), ...(request.headers.get("x-edaya-client") === "native" ? { token: result.credential } : {}) }, 200, { "set-cookie": cookie(result.credential, Math.max(0, Math.floor((result.session.expiresAt - Date.now()) / 1000))) });
  }
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (request.method === "GET" && path === "/auth/edaya/methods") {
        return json({ methods: [
          { key: "email_otp", kind: "email", channels: ["email"] },
          { key: "phone_otp", kind: "phone", channels: [env.TELEGRAM_GATEWAY_TOKEN ? "telegram" : null, env.WHATSAPP_ACCESS_TOKEN ? "whatsapp" : null].filter(Boolean) },
        ] });
      }
      if (request.method === "GET" && path === "/auth/edaya/dev/last-otp" && isDevOtpPeekEnabled(env)) {
        if (!url.searchParams.get("email")?.trim())
          return json({ message: "Email is required" }, 400);
        const otp = getLastAuthOtpForTests(url.searchParams.get("email") ?? "");
        return otp ? json({ otp }) : json({ code: "not_found" }, 404);
      }
      if (request.method !== "POST" || !path.startsWith("/auth/edaya/"))
        return json({ code: "not_found" }, 404);
      const origin = request.headers.get("origin");
      const trusted = env.TRUSTED_ORIGINS.split(",").map(v => v.trim());
      if (origin && origin !== new URL(env.BETTER_AUTH_URL).origin && !trusted.includes(origin))
        throw new AuthError("untrusted_origin", 403);
      // Cookie requests require Origin; native clients use an explicit bearer renewal credential.
      if (!origin && request.headers.has("cookie"))
        throw new AuthError("origin_required", 403);
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        throw new AuthError("json_required", 415);
      const body: unknown = await request.json();
      const renewal = credential(request);
      const ip = env.RUNTIME === "worker" ? request.headers.get("cf-connecting-ip") ?? "unknown" : "local";
      switch (path) {
        case "/auth/edaya/otp/start": return json(await service.begin({ ...startSchema.parse(body), ip }));
        case "/auth/edaya/identifiers/start": return json(await service.begin({ ...startSchema.parse(body), ip, credential: renewal || "invalid" }));
        case "/auth/edaya/otp/verify": {
          const input = verifySchema.parse(body);
          return outcome(await service.verify(input.challenge, input.code, renewal), request);
        }
        case "/auth/edaya/totp/verify": {
          const input = verifySchema.parse(body);
          return outcome(await service.verifySecondFactor(input.challenge, input.code), request);
        }
        case "/auth/edaya/totp/enroll": return json(await service.beginEnrollment({ ...enrollmentSchema.parse(body), credential: renewal }));
        case "/auth/edaya/totp/confirm": {
          const input = verifySchema.parse(body);
          return outcome(await service.confirmEnrollment(input.challenge, input.code), request);
        }
        case "/auth/edaya/recovery": {
          const input = verifySchema.parse(body);
          return json(await service.recover(input.challenge, input.code));
        }
        case "/auth/edaya/identifiers/unlink": {
          const input = z.object({ identifierId: z.string() }).strict().parse(body);
          await service.unlink(renewal, input.identifierId);
          return json({ success: true }, 200, { "set-cookie": cookie("", 0) });
        }
        case "/auth/edaya/security": return json(await service.securityStatus(renewal));
        case "/auth/edaya/totp/disable": {
          await service.disableTotp(renewal);
          return json({ success: true }, 200, { "set-cookie": cookie("", 0) });
        }
        case "/auth/edaya/session": {
          const { account, session } = await service.getSession(renewal);
          return json({ account, user: accountUser(account), session: sessionDto(session) });
        }
        case "/auth/edaya/access-token": {
          const audience = resolveAllowlistedApiOrigin(tokenSchema.parse(body).resource, env.firstPartyApiOrigins);
          if (!audience)
            throw new AuthError("invalid_resource");
          const { account, session } = await service.getSession(renewal);
          const user = accountUser(account);
          return json(await signIdentityAccessToken(keys, { sub: account.id, iss: env.BETTER_AUTH_URL, aud: audience, sid: session.id, ...(user.email ? { email: user.email, email_verified: true } : {}), ...(user.phone ? { phone: user.phone, phone_verified: true } : {}), auth_time: Math.floor(session.primaryAt / 1000), ...(session.secondAt ? { mfa_time: Math.floor(session.secondAt / 1000) } : {}), amr: [session.method === "email" ? "email_otp" : "phone_otp", ...(session.secondAt ? ["totp"] : [])] }));
        }
        case "/auth/edaya/sign-out":
        case "/auth/edaya/sign-out-all": {
          await service.signOut(renewal, path.endsWith("sign-out-all"));
          return json({ success: true }, 200, { "set-cookie": cookie("", 0) });
        }
        default: return json({ code: "not_found" }, 404);
      }
    }
    catch (error) {
      if (error instanceof AuthError)
        return json({ code: error.code, message: error.code.replaceAll("_", " ") }, error.status);
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return json({ code: "invalid_request" }, 400);
      // Provider/database failures must not disclose secrets or SQL statements.
      return json({ code: "authentication_unavailable" }, 503);
    }
  };
}
