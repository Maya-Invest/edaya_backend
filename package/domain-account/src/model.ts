export type IdentifierKind = 'email' | 'phone'
export type OtpChannel = 'email' | 'telegram' | 'whatsapp'
export interface Identifier {
  id: string
  kind: IdentifierKind
  value: string
  verifiedAt: number
  recoveryEligible: boolean
}
export interface Account {
  id: string
  status: 'active' | 'disabled'
  name: string
  securityVersion: number
  identifiers: Identifier[]
  createdAt: number
}
export interface AccountSecurity {
  secret?: string
  lastStep?: number
  recoveryHashes: string[]
}
export interface PrimaryEvidence {
  provider: string
  subject: string
  kind: IdentifierKind
  value: string
}
export interface AuthSession {
  id: string
  accountId: string
  digest: string
  primaryAt: number
  secondAt?: number
  expiresAt: number
  securityVersion: number
  generation: string
  method: IdentifierKind
}
export interface AuthChallenge {
  id: string
  kind: IdentifierKind
  value: string
  channel: OtpChannel
  purpose: 'login' | 'link'
  accountId?: string
  sessionDigest?: string
  createdAt: number
  expiresAt: number
  attempts: number
  consumed: boolean
  recoveryEligible: boolean
}
export interface PendingAuth {
  digest: string
  accountId: string
  primaryAt: number
  method: IdentifierKind
  expiresAt: number
  attempts: number
  generation: string
  securityVersion: number
  recoveryEligible: boolean
  enrollmentSecret?: string
  replacing?: boolean
}
export type AuthOutcome = {
  state: 'complete'
  credential: string
  account: Account
  session: AuthSession
} | {
  state: 'totp_required' | 'enrollment_required'
  challenge: string
}
export class AuthError extends Error {
  constructor(readonly code: string, readonly status = 400) {
    super(code)
    this.name = 'AuthError'
  }
}
export function normalizeIdentifier(kind: IdentifierKind, value: string): string {
  const normalized = kind === 'email' ? value.trim().toLowerCase() : value.trim().replace(/[ ().-]/g, '')
  if (kind === 'email' ? !/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(normalized) || normalized.length > 254 : !/^\+[1-9]\d{6,14}$/.test(normalized))
    throw new AuthError('invalid_identifier')
  return normalized
}
