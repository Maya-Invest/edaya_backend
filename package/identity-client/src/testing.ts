import type { JSONWebKeySet, JWK } from 'jose'
import type { IdentityClaims } from './claims'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { ACCESS_TOKEN_TTL_SECONDS } from './claims'

export interface TestIdentityKeys {
  privateKey: CryptoKey
  jwks: JSONWebKeySet
}

export async function createTestIdentityKeys(): Promise<TestIdentityKeys> {
  const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true })
  const publicJwk = await exportJWK(publicKey)
  publicJwk.kid = 'test-identity'
  publicJwk.use = 'sig'
  publicJwk.alg = 'ES256'
  return {
    privateKey,
    jwks: { keys: [publicJwk as JWK] },
  }
}

export async function signTestIdentityToken(
  keys: TestIdentityKeys,
  claims: IdentityClaims & { iss: string, aud: string, expSeconds?: number },
): Promise<string> {
  const expSeconds = claims.expSeconds ?? ACCESS_TOKEN_TTL_SECONDS
  return new SignJWT({
    auth_time: claims.auth_time ?? Math.floor(Date.now() / 1000),
    amr: claims.amr ?? [claims.phone ? 'phone_otp' : 'email_otp'],
    ...(claims.mfa_time !== undefined ? { mfa_time: claims.mfa_time } : {}),
    ...(claims.email ? { email: claims.email } : {}),
    ...(claims.phone ? { phone: claims.phone } : {}),
    ...(claims.email_verified !== undefined ? { email_verified: claims.email_verified } : {}),
    ...(claims.phone_verified !== undefined ? { phone_verified: claims.phone_verified } : {}),
    ...(claims.sid ? { sid: claims.sid } : {}),
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-identity', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(claims.iss)
    .setAudience(claims.aud)
    .setIssuedAt()
    .setExpirationTime(`${expSeconds}s`)
    .sign(keys.privateKey as never)
}
