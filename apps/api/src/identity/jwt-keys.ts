import type { JSONWebKeySet, JWK } from "jose";
import type { SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { exportJWK, generateKeyPair, importJWK, SignJWT } from "jose";
import { ACCESS_TOKEN_TTL_SECONDS } from "./server/index";

interface JwksRow {
  id: string;
  public_key: string;
  private_key: string;
  alg: string | null;
}
export interface IdentitySigningKeys {
  kid: string;
  privateKey: CryptoKey;
  jwks: JSONWebKeySet;
}
export interface IdentityAccessTokenClaims {
  sub: string;
  auth_time?: number;
  mfa_time?: number;
  amr?: string[];
  email?: string;
  phone?: string;
  email_verified?: boolean;
  phone_verified?: boolean;
  sid?: string;
  iss: string;
  aud: string;
}
function rows<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[];
  }
  throw new Error("Unsupported auth database query result");
}
function asPublicJwk(raw: string, fallbackKid: string, alg: string): JWK {
  const parsed = JSON.parse(raw) as JWK;
  parsed.kid = parsed.kid ?? fallbackKid;
  parsed.use = "sig";
  parsed.alg = parsed.alg ?? alg;
  delete parsed.d;
  return parsed;
}
export async function ensureIdentitySigningKeys(database: unknown): Promise<IdentitySigningKeys> {
  const db = database as {
    execute: (query: SQL) => Promise<unknown>;
  };
  let existing = rows<JwksRow>(await db.execute(sql`
    SELECT id, public_key, private_key, alg FROM identity.jwks ORDER BY created_at ASC
  `));
  if (existing.length === 0) {
    const id = randomUUID();
    const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
    const publicJwk = await exportJWK(publicKey);
    const privateJwk = await exportJWK(privateKey);
    publicJwk.kid = id;
    publicJwk.use = "sig";
    publicJwk.alg = "ES256";
    privateJwk.kid = id;
    privateJwk.alg = "ES256";
    const createdAt = new Date();
    await db.execute(sql`
      INSERT INTO identity.jwks (id, public_key, private_key, created_at, alg)
      VALUES (${id}, ${JSON.stringify(publicJwk)}, ${JSON.stringify(privateJwk)}, ${createdAt.toISOString()}, ${"ES256"})
    `);
    existing = rows<JwksRow>(await db.execute(sql`
      SELECT id, public_key, private_key, alg FROM identity.jwks ORDER BY created_at ASC
    `));
  }
  const active = existing[0];
  if (!active) {
    throw new Error("Identity signing keys are unavailable");
  }
  const alg = active.alg ?? "ES256";
  const privateJwk = JSON.parse(active.private_key) as JWK;
  privateJwk.kid = privateJwk.kid ?? active.id;
  privateJwk.alg = privateJwk.alg ?? alg;
  const privateKey = await importJWK(privateJwk, alg) as CryptoKey;
  return {
    kid: privateJwk.kid ?? active.id,
    privateKey,
    jwks: {
      keys: existing.map(row => asPublicJwk(row.public_key, row.id, row.alg ?? "ES256")),
    },
  };
}
export async function signIdentityAccessToken(keys: IdentitySigningKeys, claims: IdentityAccessTokenClaims): Promise<{
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
}> {
  if (typeof claims.aud !== "string" || claims.aud.trim() === "") {
    throw new Error("Access token audience must be a canonical origin string");
  }
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);
  const accessToken = await new SignJWT({
    ...(claims.auth_time !== undefined ? { auth_time: claims.auth_time } : {}),
    ...(claims.mfa_time !== undefined ? { mfa_time: claims.mfa_time } : {}),
    ...(claims.amr ? { amr: claims.amr } : {}),
    ...(claims.email ? { email: claims.email } : {}),
    ...(claims.phone ? { phone: claims.phone } : {}),
    ...(claims.email_verified !== undefined ? { email_verified: claims.email_verified } : {}),
    ...(claims.phone_verified !== undefined ? { phone_verified: claims.phone_verified } : {}),
    ...(claims.sid ? { sid: claims.sid } : {}),
  })
    .setProtectedHeader({ alg: "ES256", kid: keys.kid, typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(claims.iss)
    .setAudience(claims.aud)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(keys.privateKey as Parameters<SignJWT["sign"]>[0]);
  return { accessToken, tokenType: "Bearer", expiresAt: expiresAt.toISOString() };
}
