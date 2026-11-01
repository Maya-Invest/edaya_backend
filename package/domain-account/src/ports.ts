import type { Account, AccountSecurity, AuthChallenge, AuthSession, DeliveryReceipt, DeliveryResult, IdentifierKind, OtpChannel, PendingAuth, PrimaryEvidence, RecipientCooldown } from './model'
import type { TermsAcceptance } from './terms'

export interface AuthenticationProviderPort {
  readonly generation: string
  /** Prepare a hashed phone OTP in the current transaction. No network delivery. */
  preparePhoneOtp?: (value: string) => Promise<string>
  sendOtp: (input: {
    kind: IdentifierKind
    value: string
    channel: OtpChannel
    attemptId?: string
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
    locale?: 'fr' | 'en'
    attemptId?: string
  }) => Promise<DeliveryResult | void>
}
export interface PhoneAuthPort {
  mode: 'disabled' | 'sms_only' | 'whatsapp_first'
  supports: (phone: string) => boolean
  delivery: OtpDeliveryPort
}
export interface AccountRepositoryPort {
  saveTermsAcceptance: (acceptance: TermsAcceptance) => Promise<void>
  transaction: <T>(work: () => Promise<T>) => Promise<T>
  find: (kind: IdentifierKind, value: string) => Promise<Account | null>
  get: (id: string) => Promise<Account | null>
  save: (account: Account) => Promise<void>
  security: (id: string) => Promise<AccountSecurity>
  saveSecurity: (id: string, security: AccountSecurity) => Promise<void>
  challenge: (id: string) => Promise<AuthChallenge | null>
  saveChallenge: (challenge: AuthChallenge) => Promise<void>
  challengeAttempts: (kind: IdentifierKind, value: string, now: number) => Promise<number>
  challengeByMessage: (messageId: string) => Promise<AuthChallenge | null>
  supersede: (kind: IdentifierKind, value: string, now?: number) => Promise<number>
  cooldown: (value: string) => Promise<RecipientCooldown | null>
  saveCooldown: (value: string, cooldown: RecipientCooldown) => Promise<void>
  deliveryRequest: (id: string) => Promise<{ fingerprint: string, challenge: string } | null>
  saveDeliveryRequest: (id: string, fingerprint: string, challenge: string, expiresAt: number) => Promise<void>
  receipts: (messageId: string) => Promise<DeliveryReceipt[]>
  saveReceipt: (receipt: DeliveryReceipt, expiresAt: number) => Promise<boolean>
  reserveSendQuota: (ip: string, recipient: string, now: number, fixtures: boolean) => Promise<boolean>
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
