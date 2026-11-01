import type { Account, AccountService, AuthOutcome, AuthSession, RegistrationOffer } from "@edaya/account";
import type { Environment } from "./env";
import type { IdentitySigningKeys } from "./jwt-keys";
import { AuthError } from "@edaya/account";
import { hashInvitationToken } from "@edaya/service";
import { z } from "zod";
import { AuthUnlink, AuthEnrollmentInput as enrollmentSchema, RegistrationInput, AuthResend as resendSchema, AuthStart as startSchema, AuthChallengeInput as statusSchema, AuthResource as tokenSchema, AuthProof as verifySchema } from "./contracts";
import { resolveAllowlistedApiOrigin } from "./env";
import { signIdentityAccessToken } from "./jwt-keys";
import { phoneSmsPrefixes } from "./phone-config";
import { assertAuthRequest, authCookieName, authCredential } from "./request-policy";
import { createWhatsAppWebhook } from "./whatsapp-webhook";

const authPostPaths = new Set([
  "otp/start",
  "identifiers/start",
  "otp/status",
  "otp/resend",
  "otp/verify",
  "registration/complete",
  "totp/verify",
  "totp/enroll",
  "totp/confirm",
  "recovery",
  "identifiers/unlink",
  "security",
  "totp/disable",
  "session",
  "access-token",
  "sign-out",
  "sign-out-all",
].map(path => `/auth/edaya/${path}`));

/** Unknown authentication routes fail before runtime/database initialization. */
export function isAccountAuthRoute(request: Request) {
  const path = new URL(request.url).pathname;
  return path === "/auth/edaya/whatsapp/webhook"
    || (request.method === "GET" && ["/auth/edaya/methods", "/auth/edaya/terms"].includes(path))
    || (request.method === "POST" && authPostPaths.has(path));
}

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
  const cookieName = authCookieName(env);
  const webhook = createWhatsAppWebhook(service, env);
  const cookie = (value: string, maxAge: number) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
  function json(value: unknown, status = 200, extra: Record<string, string> = {}) {
    return Response.json(value, { status, headers: { "cache-control": "no-store", ...extra } });
  }
  function outcome(result: AuthOutcome | RegistrationOffer | {
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
      if (path === "/auth/edaya/whatsapp/webhook")
        return webhook(request);
      if (request.method === "GET" && path === "/auth/edaya/terms") {
        const locale = z.enum(["fr", "en"]).parse(url.searchParams.get("locale") ?? "fr");
        return json(await service.getTerms(locale));
      }
      if (request.method === "GET" && path === "/auth/edaya/methods") {
        return json({ publicAccountRegistration: env.ALLOW_PUBLIC_ACCOUNT_REGISTRATION === true, methods: [
          { key: "email_otp", kind: "email", channels: ["email"] },
          { key: "phone_otp", kind: "phone", available: env.PHONE_AUTH_MODE !== "disabled" && phoneSmsPrefixes(env.SMS_ROUTES).length > 0, countries: env.PHONE_AUTH_MODE !== "disabled" && phoneSmsPrefixes(env.SMS_ROUTES).length > 0 ? ["CI"] : [], prefixes: env.PHONE_AUTH_MODE !== "disabled" ? phoneSmsPrefixes(env.SMS_ROUTES) : [] },
        ] });
      }
      if (request.method !== "POST" || !authPostPaths.has(path))
        return json({ code: "not_found" }, 404);
      assertAuthRequest(request, env);
      const body: unknown = await request.json();
      const renewal = authCredential(request, env);
      const ip = env.RUNTIME === "worker" ? request.headers.get("cf-connecting-ip") ?? "unknown" : "local";
      switch (path) {
        case "/auth/edaya/otp/start": {
          const { invitationToken, ...input } = startSchema.parse(body);
          return json(await service.begin({ ...input, ip, invitationHash: invitationToken ? hashInvitationToken(invitationToken) : undefined }));
        }
        case "/auth/edaya/registration/complete": return outcome(await service.completeRegistration(RegistrationInput.parse(body)), request);
        case "/auth/edaya/identifiers/start": return json(await service.begin({ ...startSchema.parse(body), ip, credential: renewal || "invalid" }));
        case "/auth/edaya/otp/status": return json(await service.status(statusSchema.parse(body).challenge, renewal));
        case "/auth/edaya/otp/resend": return json(await service.resend({ ...resendSchema.parse(body), ip, credential: renewal }));
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
          const input = AuthUnlink.parse(body);
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
        return json({ code: error.code, message: error.code.replaceAll("_", " "), ...error.details }, error.status);
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return json({ code: "invalid_request" }, 400);
      // Provider/database failures must not disclose secrets or SQL statements.
      return json({ code: "authentication_unavailable" }, 503);
    }
  };
}
