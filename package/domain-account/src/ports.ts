import type { Account, AccountSecurity, AuthChallenge, AuthSession, IdentifierKind, OtpChannel, PendingAuth, PrimaryEvidence } from './model'

export interface AuthenticationProviderPort {
  readonly generation: string
  sendOtp: (input: {
    kind: IdentifierKind
    value: string
    channel: OtpChannel
  }) => Promise<void>
  verifyOtp: (input: {
    kind: IdentifierKind
    value: string
    code: string
  }) => Promise<PrimaryEvidence | null>
}
export interface OtpDeliveryPort {
  send: (input: {
    channel: OtpChannel
    destination: string
    code: string
  }) => Promise<void>
}
export interface AccountRepositoryPort {
  transaction: <T>(work: () => Promise<T>) => Promise<T>
  find: (kind: IdentifierKind, value: string) => Promise<Account | null>
  get: (id: string) => Promise<Account | null>
  save: (account: Account) => Promise<void>
  security: (id: string) => Promise<AccountSecurity>
  saveSecurity: (id: string, security: AccountSecurity) => Promise<void>
  challenge: (id: string) => Promise<AuthChallenge | null>
  saveChallenge: (challenge: AuthChallenge) => Promise<void>
  supersede: (kind: IdentifierKind, value: string) => Promise<number>
  resetChallengeAttempts: (kind: IdentifierKind, value: string) => Promise<void>
  pending: (digest: string) => Promise<PendingAuth | null>
  savePending: (pending: PendingAuth) => Promise<void>
  deletePending: (digest: string) => Promise<void>
  session: (digest: string) => Promise<AuthSession | null>
  saveSession: (session: AuthSession) => Promise<void>
  revoke: (accountId: string, digest?: string) => Promise<void>
  quota: (key: string, maximum: number, windowSeconds: number, now: number) => Promise<boolean>
  mappedAccount: (evidence: PrimaryEvidence) => Promise<string | null>
  unlinkProvider: (kind: IdentifierKind, value: string) => Promise<void>
  linkProvider: (evidence: PrimaryEvidence, accountId: string) => Promise<void>
  audit: (accountId: string, event: string, now: number) => Promise<void>
}
export interface AccountSecurityPort {
  token: () => string
  digest: (value: string) => Promise<string>
  newSecret: () => string
  encrypt: (secret: string) => Promise<string>
  decrypt: (ciphertext: string) => Promise<string>
  verifyTotp: (secret: string, code: string, now: number, lastStep?: number) => Promise<number | null>
}
export interface PrivilegedAccountPolicyPort {
  requiresTotp: (accountId: string) => Promise<boolean>
}
