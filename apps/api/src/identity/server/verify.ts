/* eslint-disable dot-notation -- TypeScript requires bracket access for untyped JWT claims. */
import type { JSONWebKeySet } from "jose";
import type { IdentityClaims } from "./claims";
import { createLocalJWKSet, jwtVerify } from "jose";
import { IdentityTokenError } from "./claims";

export interface VerifyIdentityTokenOptions {
  issuer: string;
  audience: string;
  jwks: JSONWebKeySet;
  clockTolerance?: number;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizePhone(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.startsWith("+") ? trimmed : undefined;
}

export async function verifyIdentityToken(
  token: string,
  options: VerifyIdentityTokenOptions,
): Promise<IdentityClaims> {
  if (!token || token.split(".").length !== 3) {
    throw new IdentityTokenError("invalid", "Identity token must be a compact JWS");
  }

  let payload;
  try {
    const verified = await jwtVerify(token, createLocalJWKSet(options.jwks), {
      algorithms: ["ES256"],
      issuer: options.issuer,
      audience: [options.audience, `${options.audience}/teacher`],
      clockTolerance: options.clockTolerance ?? 0,
    });
    payload = verified.payload;
  }
  catch (error) {
    const message = error instanceof Error ? error.message : "Identity token verification failed";
    if (message.toLowerCase().includes("expir")) {
      throw new IdentityTokenError("expired", message);
    }
    if (message.toLowerCase().includes("audience") || message.toLowerCase().includes("\"aud\"")) {
      throw new IdentityTokenError("audience", message);
    }
    if (message.toLowerCase().includes("issuer") || message.toLowerCase().includes("\"iss\"")) {
      throw new IdentityTokenError("issuer", message);
    }
    throw new IdentityTokenError("invalid", message);
  }

  const sub = optionalString(payload.sub);
  if (!sub) {
    throw new IdentityTokenError("claims", "Identity token is missing sub");
  }

  const email = optionalString(payload["email"]);
  const phone = normalizePhone(optionalString(payload["phone"]));
  const authTime = payload["auth_time"];
  const mfaTime = payload["mfa_time"];
  const methods = payload["amr"];
  if (typeof payload.iat !== "number" || typeof payload.exp !== "number" || payload.exp - payload.iat > 300
    || typeof authTime !== "number" || !Number.isInteger(authTime) || authTime < 0 || authTime > payload.iat
    || !Array.isArray(methods) || !methods.every(m => typeof m === "string") || methods.length === 0
    || (mfaTime !== undefined && (typeof mfaTime !== "number" || !Number.isInteger(mfaTime) || mfaTime < authTime || mfaTime > payload.iat || !methods.includes("totp")))
    || (methods.includes("totp") && mfaTime === undefined)) {
    throw new IdentityTokenError("claims", "Invalid authentication evidence");
  }

  const scope = payload["teacherScope"] as IdentityClaims["teacherScope"];
  const scopedAudience = payload.aud === `${options.audience}/teacher`;
  if (scopedAudience) {
    if (!scope || typeof scope.schoolId !== "string" || !scope.schoolId || typeof scope.teacherId !== "string" || !scope.teacherId || !methods.includes("teacher_code"))
      throw new IdentityTokenError("claims", "Invalid teacher scope");
  }
  else if (scope || methods.includes("teacher_code")) {
    throw new IdentityTokenError("claims", "Teacher credentials require the scoped audience");
  }
  return {
    teacherScope: scope,
    sub,
    auth_time: authTime,
    amr: methods,
    ...(typeof mfaTime === "number" ? { mfa_time: mfaTime } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(optionalBoolean(payload["email_verified"]) !== undefined
      ? { email_verified: payload["email_verified"] as boolean }
      : {}),
    ...(optionalBoolean(payload["phone_verified"]) !== undefined
      ? { phone_verified: payload["phone_verified"] as boolean }
      : {}),
    ...(optionalString(payload["sid"]) ? { sid: optionalString(payload["sid"]) } : {}),
  };
}
