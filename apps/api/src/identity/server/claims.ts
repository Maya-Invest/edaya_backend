export const IDENTITY_JWKS_PATH = "/.well-known/jwks.json";
export const ACCESS_TOKEN_TTL_SECONDS = 5 * 60;

export type DirectoryContactChannel = "email" | "phone";

export interface IdentityClaims {
  auth_time?: number;
  mfa_time?: number;
  amr?: string[];
  sub: string;
  email?: string;
  phone?: string;
  email_verified?: boolean;
  phone_verified?: boolean;
  sid?: string;
}

export interface DirectoryLookupResult {
  exists: boolean;
  id?: string;
}

export interface DirectoryContact {
  identifiers?: Array<{ kind: DirectoryContactChannel; value: string }>;
  email?: string;
  phone?: string;
}

export class IdentityTokenError extends Error {
  readonly code: "invalid" | "expired" | "audience" | "issuer" | "claims";

  constructor(code: IdentityTokenError["code"], message: string) {
    super(message);
    this.name = "IdentityTokenError";
    this.code = code;
  }
}
