import type { Account, AuthChallenge, AuthOutcome, AuthSession, DeliveryReceipt, IdentifierKind, OtpChannel, PendingAuth } from './model'
import type { AccountRepositoryPort, AccountSecurityPort, AuthenticationProviderPort, PhoneAuthPort, PrivilegedAccountPolicyPort } from './ports'
import type { AcceptedTerms, TermsAcceptanceInput, TermsLocale, TermsPolicyPort } from './terms'
import { AuthError, normalizeIdentifier } from './model'

const FIVE_MINUTES = 300000
/** Owns Account policy. Provider sessions and identities never confer business access. */
export class AccountService {
  constructor(private readonly repository: AccountRepositoryPort, private readonly provider: AuthenticationProviderPort, private readonly crypto: AccountSecurityPort, private readonly policy: PrivilegedAccountPolicyPort, private readonly now: () => number = Date.now, private readonly localFixtures = false, private readonly phone?: PhoneAuthPort, private readonly terms?: TermsPolicyPort) { }
  // Expected failures commit attempt counters; infrastructure failures roll back.
  private async atomic<T>(work: () => Promise<T>): Promise<T> {
    const result = await this.repository.transaction(async () => {
      try {
        return { value: await work() }
      }
      catch (error) {
        if (error instanceof AuthError)
          return { error }
        throw error
      }
    })
    if ('error' in result)
      throw result.error
    return result.value
  }

  getTerms(locale: TermsLocale) {
    return this.terms?.current(locale) ?? { enforced: false, document: null }
  }

  private acceptedTerms(input?: TermsAcceptanceInput): AcceptedTerms | undefined {
    const policy = this.getTerms(input?.locale ?? 'fr')
    if (!policy.enforced)
      return undefined
    if (!policy.document)
      throw new AuthError('terms_unavailable', 503)
    if (!input?.accepted)
      throw new AuthError('terms_acceptance_required')
    if (input.version !== policy.document.version)
      throw new AuthError('terms_version_changed', 409)
    return { version: input.version, locale: policy.document.locale, documentHash: policy.document.documentHash }
  }

  async begin(input: {
    termsAcceptance?: TermsAcceptanceInput
    kind: IdentifierKind
    value: string
    channel?: OtpChannel | 'telegram'
    ip: string
    locale?: 'fr' | 'en'
    requestId?: string
    credential?: string
    recoveryEligible?: boolean
  }) {
    const terms = input.credential ? undefined : this.acceptedTerms(input.termsAcceptance)
    return this.beginAccepted(input, terms)
  }

  private async beginAccepted(input: Parameters<AccountService['begin']>[0], terms?: AcceptedTerms) {
    const value = normalizeIdentifier(input.kind, input.value)
    if (input.channel === 'telegram')
      throw new AuthError('unsupported_channel')
    if (input.kind === 'phone') {
      if (input.channel && input.channel !== 'whatsapp')
        throw new AuthError('unsupported_channel')
      return this.requestPhone({ ...input, value, terms })
    }
    if (input.channel && input.channel !== 'email')
      throw new AuthError('invalid_channel')
    return this.atomic(async () => {
      const now = this.now()
      const session = input.credential ? await this.requireRecent(input.credential) : null
      if (!await this.repository.quota(`send:ip:${input.ip}`, this.localFixtures ? 10000 : 20, 600, now)
        || !await this.repository.quota(`send:recipient:${input.kind}:${value}`, this.localFixtures ? 10000 : 5, 3600, now)
        || !await this.repository.quota(`cooldown:${input.kind}:${value}`, this.localFixtures ? 10000 : 1, 60, now)) {
        throw new AuthError('rate_limited', 429)
      }
      const attempts = await this.repository.supersede(input.kind, value, now)
      if (attempts >= 5)
        throw new AuthError('attempts_exhausted', 429)
      const id = this.crypto.token()
      const challenge = { terms, id, kind: input.kind, value, channel: 'email' as const, purpose: session ? 'link' as const : 'login' as const, ...(session ? { accountId: session.accountId, sessionDigest: session.digest } : {}), createdAt: now, expiresAt: now + FIVE_MINUTES, attempts, consumed: false, recoveryEligible: input.recoveryEligible === true }
      await this.repository.saveChallenge(challenge)
      try {
        await this.provider.sendOtp({ kind: input.kind, value, channel: 'email', attemptId: id })
      }
      catch {
        challenge.consumed = true
        await this.repository.saveChallenge(challenge)
        throw new AuthError('delivery_unavailable', 503)
      }
      return { ...this.primaryStatus(challenge), resendAfter: 60 }
    })
  }

  private primaryStatus(challenge: AuthChallenge) {
    const now = this.now()
    const lifecycle = challenge.superseded ? 'superseded' : challenge.consumed ? 'completed' : challenge.attempts >= 5 ? 'exhausted' : challenge.expiresAt <= now ? 'expired' : 'pending'
    const replaceable = !challenge.consumed && !challenge.superseded && challenge.attempts < 5 && now < challenge.expiresAt + 3600000
    return { state: 'primary_required' as const, challenge: challenge.id, lifecycle, channel: challenge.channel, delivery: challenge.delivery === 'pending' && now - challenge.createdAt > 10000 ? 'uncertain' : challenge.delivery ?? 'accepted', expiresAt: challenge.expiresAt, nextResendAt: challenge.nextResendAt ?? challenge.createdAt + 60000, serverNow: now, actions: { resend: replaceable, sms: replaceable && challenge.channel === 'whatsapp' } }
  }

  private async authorizeChallenge(challenge: AuthChallenge, credential?: string) {
    if (challenge.purpose === 'link') {
      const session = await this.requireRecent(credential ?? '')
      if (session.digest !== challenge.sessionDigest || session.accountId !== challenge.accountId)
        throw new AuthError('invalid_challenge', 403)
    }
  }

  async status(challengeId: string, credential?: string) {
    const challenge = await this.repository.challenge(challengeId)
    if (!challenge || this.now() >= challenge.expiresAt + 3600000)
      throw new AuthError('challenge_expired')
    await this.authorizeChallenge(challenge, credential)
    const result = this.primaryStatus(challenge)
    if (challenge.kind === 'phone') {
      const cooldown = await this.repository.cooldown(challenge.value)
      if (cooldown)
        result.nextResendAt = Math.max(result.nextResendAt, cooldown.nextResendAt)
    }
    return result
  }

  async resend(input: { challenge: string, action: 'resend' | 'sms', ip: string, requestId: string, credential?: string }) {
    const previous = await this.repository.challenge(input.challenge)
    if (!previous)
      throw new AuthError('challenge_expired')
    if (previous.kind === 'phone')
      return this.requestPhone(input)
    await this.authorizeChallenge(previous, input.credential)
    if (input.action !== 'resend' || previous.consumed || previous.attempts >= 5 || this.now() >= previous.expiresAt + 3600000)
      throw new AuthError('challenge_expired')
    return this.beginAccepted({ kind: 'email', value: previous.value, channel: 'email', ip: input.ip, credential: previous.purpose === 'link' ? input.credential : undefined, recoveryEligible: previous.recoveryEligible }, previous.terms)
  }

  private async requestPhone(input: { terms?: AcceptedTerms, value?: string, challenge?: string, action?: 'resend' | 'sms', ip: string, requestId?: string, credential?: string, recoveryEligible?: boolean, locale?: 'fr' | 'en' }) {
    const phone = this.phone
    if (!phone || phone.mode === 'disabled' || !this.provider.preparePhoneOtp)
      throw new AuthError('phone_auth_unavailable', 503)
    const requestId = input.requestId ?? this.crypto.token()
    const prepared = await this.atomic(async () => {
      const now = this.now()
      const previous = input.challenge ? await this.repository.challenge(input.challenge) : null
      if (input.challenge && (!previous || previous.kind !== 'phone'))
        throw new AuthError('invalid_challenge')
      const value = previous?.value ?? normalizeIdentifier('phone', input.value ?? '')
      if (!phone.supports(value))
        throw new AuthError('phone_country_unsupported')
      // The first release accepts only Ivorian mobile numbers (01, 05, 07).
      if (!/^\+225(?:01|05|07)\d{8}$/.test(value))
        throw new AuthError('invalid_identifier')
      const session = previous?.purpose === 'login' ? null : input.credential ? await this.requireRecent(input.credential) : null
      if (previous)
        await this.authorizeChallenge(previous, input.credential)
      const selected: OtpChannel = input.action === 'sms' ? 'sms' : previous?.channel ?? (phone.mode === 'sms_only' ? 'sms' : 'whatsapp')
      const fingerprint = await this.crypto.digest(JSON.stringify([value, previous?.id ?? null, input.action ?? 'start', session?.digest ?? null, selected, previous?.recoveryEligible ?? input.recoveryEligible === true, previous?.locale ?? input.locale ?? 'fr', previous?.terms ?? input.terms]))
      const replay = await this.repository.deliveryRequest(requestId)
      if (replay) {
        if (replay.fingerprint !== fingerprint)
          throw new AuthError('idempotency_conflict', 409)
        const challenge = await this.repository.challenge(replay.challenge)
        if (!challenge)
          throw new AuthError('challenge_expired')
        return { challenge }
      }
      if (previous && (previous.consumed || previous.attempts >= 5 || now >= previous.expiresAt + 3600000))
        throw new AuthError(previous.attempts >= 5 ? 'attempts_exhausted' : 'challenge_expired')
      if (input.action === 'sms' && previous?.channel !== 'whatsapp')
        throw new AuthError('unsupported_channel')
      const cooldown = await this.repository.cooldown(value)
      if (cooldown && now < cooldown.nextResendAt)
        throw new AuthError('rate_limited', 429, { nextResendAt: cooldown.nextResendAt, serverNow: now })
      if (await this.repository.challengeAttempts('phone', value, now) >= 5)
        throw new AuthError('attempts_exhausted', 429)
      if (!await this.repository.reserveSendQuota(input.ip, value, now, this.localFixtures))
        throw new AuthError('rate_limited', 429)
      const attempts = await this.repository.supersede('phone', value, now)
      const count = cooldown && now - cooldown.lastSentAt < 3600000 ? cooldown.count + 1 : 1
      const nextResendAt = now + (count === 1 ? 60 : count === 2 ? 120 : 300) * 1000
      const challenge: AuthChallenge = { terms: previous ? previous.terms : input.terms, id: this.crypto.token(), kind: 'phone', value, channel: selected, purpose: previous?.purpose ?? (session ? 'link' : 'login'), ...(session ? { accountId: session.accountId, sessionDigest: session.digest } : {}), createdAt: now, expiresAt: now + FIVE_MINUTES, attempts, consumed: false, recoveryEligible: previous?.recoveryEligible ?? input.recoveryEligible === true, locale: previous?.locale ?? input.locale ?? 'fr', nextResendAt, delivery: 'pending' }
      // The provider stores only the hash; the plaintext lives in this request.
      const code = await this.provider.preparePhoneOtp!(value)
      await this.repository.saveChallenge(challenge)
      await this.repository.saveCooldown(value, { count, lastSentAt: now, nextResendAt })
      await this.repository.saveDeliveryRequest(requestId, fingerprint, challenge.id, challenge.expiresAt + 3600000)
      return { challenge, code }
    })
    if (!prepared.code)
      return this.primaryStatus(prepared.challenge)
    let result
    try {
      result = await phone.delivery.send({ channel: prepared.challenge.channel, destination: prepared.challenge.value, code: prepared.code, locale: prepared.challenge.locale, attemptId: prepared.challenge.id }) ?? { status: 'accepted' as const }
    }
    catch {
      result = { status: 'uncertain' as const }
    }
    // Network IO never holds the authentication transaction open.
    return this.atomic(async () => {
      const challenge = (await this.repository.challenge(prepared.challenge.id))!
      if (challenge.delivery === 'pending')
        challenge.delivery = result.status
      if (result.messageId) {
        challenge.messageId = result.messageId
        for (const receipt of await this.repository.receipts(result.messageId))
          this.applyReceipt(challenge, receipt)
      }
      await this.repository.saveChallenge(challenge)
      return this.primaryStatus(challenge)
    })
  }

  private applyReceipt(challenge: AuthChallenge, receipt: DeliveryReceipt) {
    if (challenge.channel !== 'whatsapp' || challenge.value !== receipt.destination || (challenge.messageId && challenge.messageId !== receipt.messageId) || (receipt.attemptId && receipt.attemptId !== challenge.id))
      return
    const rank = { pending: 0, uncertain: 0, accepted: 1, failed: 1, sent: 2, delivered: 3, read: 4 }
    const current = challenge.delivery ?? 'pending'
    if (receipt.status === 'failed' ? rank[current] < 3 : rank[receipt.status] > rank[current] && !(current === 'failed' && receipt.status === 'sent'))
      challenge.delivery = receipt.status
    challenge.messageId = receipt.messageId
  }

  async recordReceipt(receipt: DeliveryReceipt) {
    return this.atomic(async () => {
      if (!await this.repository.saveReceipt(receipt, this.now() + 3600000))
        return
      const challenge = receipt.attemptId ? await this.repository.challenge(receipt.attemptId) : await this.repository.challengeByMessage(receipt.messageId)
      if (!challenge)
        return
      this.applyReceipt(challenge, receipt)
      await this.repository.saveChallenge(challenge)
    })
  }

  async verify(challengeId: string, code: string, credential?: string): Promise<AuthOutcome | {
    state: 'linked'
    account: Account
  }> {
    return this.atomic(async () => {
      const challenge = await this.repository.challenge(challengeId)
      if (!challenge || challenge.consumed || challenge.expiresAt <= this.now())
        throw new AuthError('challenge_expired')
      if (challenge.attempts >= 5)
        throw new AuthError('attempts_exhausted', 429)
      let linkingSession: AuthSession | null = null
      if (challenge.purpose === 'link') {
        linkingSession = await this.requireRecent(credential ?? '')
        if (linkingSession.digest !== challenge.sessionDigest || linkingSession.accountId !== challenge.accountId)
          throw new AuthError('invalid_challenge', 403)
      }
      challenge.attempts++
      await this.repository.saveChallenge(challenge)
      if (!/^\d{6}$/.test(code))
        throw new AuthError('invalid_code')
      const evidence = await this.provider.verifyOtp({ kind: challenge.kind, value: challenge.value, code })
      if (!evidence || evidence.kind !== challenge.kind || evidence.value !== challenge.value)
        throw new AuthError('invalid_code')
      // A proven identifier starts a new attempt budget. Resends without proof
      // still inherit failures from superseded challenges.
      await this.repository.resetChallengeAttempts(challenge.kind, challenge.value)
      challenge.attempts = 0
      challenge.consumed = true
      await this.repository.saveChallenge(challenge)
      let account = await this.repository.find(challenge.kind, challenge.value)
      const existingMapping = await this.repository.mappedAccount(evidence)
      if (linkingSession) {
        if (account && account.id !== linkingSession.accountId)
          throw new AuthError('identifier_unavailable', 409)
        account = await this.repository.get(linkingSession.accountId)
        if (!account || account.status !== 'active')
          throw new AuthError('account_disabled', 403)
        if (!account.identifiers.some(i => i.kind === challenge.kind && i.value === challenge.value)) {
          account.identifiers.push({ id: this.crypto.token(), kind: challenge.kind, value: challenge.value, verifiedAt: this.now(), recoveryEligible: challenge.recoveryEligible })
          await this.repository.save(account)
        }
        await this.repository.linkProvider(evidence, account.id)
        await this.repository.audit(account.id, 'identifier_linked', this.now())
        return { state: 'linked' as const, account }
      }
      if (!account) {
        account = { id: this.crypto.token(), status: 'active', name: '', securityVersion: 0, createdAt: this.now(), identifiers: [{ id: this.crypto.token(), kind: challenge.kind, value: challenge.value, verifiedAt: this.now(), recoveryEligible: true }] }
        await this.repository.save(account)
        await this.repository.audit(account.id, 'account_created', this.now())
      }
      if (account.status !== 'active')
        throw new AuthError('account_disabled', 403)
      const identifier = account.identifiers.find(i => i.kind === challenge.kind && i.value === challenge.value)!
      if ((existingMapping && existingMapping !== account.id) || (!existingMapping && !identifier.recoveryEligible))
        throw new AuthError('continuity_proof_required', 403)
      await this.repository.linkProvider(evidence, account.id)
      const security = await this.repository.security(account.id)
      if (security.secret || await this.policy.requiresTotp(account.id)) {
        const token = this.crypto.token()
        await this.repository.savePending({ digest: await this.crypto.digest(token), accountId: account.id, primaryAt: this.now(), method: challenge.kind, expiresAt: this.now() + FIVE_MINUTES, attempts: 0, generation: this.provider.generation, securityVersion: account.securityVersion, recoveryEligible: identifier.recoveryEligible, terms: challenge.terms })
        return { state: security.secret ? 'totp_required' as const : 'enrollment_required' as const, challenge: token }
      }
      return this.complete(account, this.now(), challenge.kind, undefined, challenge.terms)
    })
  }

  private async complete(account: Account, primaryAt: number, method: IdentifierKind, secondAt?: number, terms?: AcceptedTerms): Promise<AuthOutcome> {
    const credential = this.crypto.token()
    const session: AuthSession = { id: this.crypto.token(), accountId: account.id, digest: await this.crypto.digest(credential), primaryAt, ...(secondAt === undefined ? {} : { secondAt }), method, expiresAt: this.now() + 7 * 86400000, securityVersion: account.securityVersion, generation: this.provider.generation }
    if (terms)
      await this.repository.saveTermsAcceptance({ ...terms, accountId: account.id, acceptedAt: this.now() })
    await this.repository.saveSession(session)
    await this.repository.audit(account.id, 'authentication_completed', this.now())
    return { state: 'complete', credential, account, session }
  }

  private async requirePending(token: string): Promise<{
    pending: PendingAuth
    account: Account
  }> {
    const pending = await this.repository.pending(await this.crypto.digest(token))
    if (!pending || pending.expiresAt <= this.now() || pending.generation !== this.provider.generation)
      throw new AuthError('challenge_expired', 401)
    const account = await this.repository.get(pending.accountId)
    if (!account || account.status !== 'active' || account.securityVersion !== pending.securityVersion)
      throw new AuthError('reauthentication_required', 401)
    if (pending.attempts >= 5)
      throw new AuthError('attempts_exhausted', 429)
    return { pending, account }
  }

  async verifySecondFactor(token: string, code: string): Promise<AuthOutcome> {
    return this.atomic(async () => {
      const { pending, account } = await this.requirePending(token)
      pending.attempts++
      await this.repository.savePending(pending)
      const security = await this.repository.security(account.id)
      if (!security.secret || pending.replacing)
        throw new AuthError('enrollment_required')
      const step = await this.crypto.verifyTotp(await this.crypto.decrypt(security.secret), code, this.now(), security.lastStep)
      if (step === null)
        throw new AuthError('invalid_code')
      security.lastStep = step
      await this.repository.saveSecurity(account.id, security)
      await this.repository.deletePending(pending.digest)
      return this.complete(account, pending.primaryAt, pending.method, this.now(), pending.terms)
    })
  }

  async beginEnrollment(input: {
    credential?: string
    challenge?: string
  }) {
    return this.atomic(async () => {
      let token = input.challenge
      let pending: PendingAuth
      if (token) {
        ({ pending } = await this.requirePending(token))
      }
      else {
        const session = await this.requireRecent(input.credential ?? '')
        token = this.crypto.token()
        pending = { digest: await this.crypto.digest(token), accountId: session.accountId, primaryAt: session.primaryAt, method: session.method, expiresAt: this.now() + FIVE_MINUTES, attempts: 0, generation: this.provider.generation, securityVersion: session.securityVersion, recoveryEligible: false }
      }
      if ((await this.repository.security(pending.accountId)).secret && !pending.replacing)
        throw new AuthError('totp_already_enabled', 409)
      if (!pending.enrollmentSecret)
        pending.enrollmentSecret = await this.crypto.encrypt(this.crypto.newSecret())
      await this.repository.savePending(pending)
      const secret = await this.crypto.decrypt(pending.enrollmentSecret)
      return { state: 'enrollment_required' as const, challenge: token, secret, uri: `otpauth://totp/EDAYA:${encodeURIComponent(pending.accountId)}?secret=${secret}&issuer=EDAYA&algorithm=SHA1&digits=6&period=30` }
    })
  }

  async confirmEnrollment(token: string, code: string) {
    return this.atomic(async () => {
      const { pending, account } = await this.requirePending(token)
      if (!pending.enrollmentSecret)
        throw new AuthError('enrollment_required')
      pending.attempts++
      await this.repository.savePending(pending)
      const existing = await this.repository.security(account.id)
      if (existing.secret && !pending.replacing)
        throw new AuthError('totp_already_enabled', 409)
      const step = await this.crypto.verifyTotp(await this.crypto.decrypt(pending.enrollmentSecret), code, this.now())
      if (step === null)
        throw new AuthError('invalid_code')
      const recoveryCodes = Array.from({ length: 10 }, () => this.crypto.token())
      await this.repository.saveSecurity(account.id, { secret: pending.enrollmentSecret, lastStep: step, recoveryHashes: await Promise.all(recoveryCodes.map(c => this.crypto.digest(c))) })
      account.securityVersion++
      await this.repository.save(account)
      await this.repository.revoke(account.id)
      await this.repository.deletePending(pending.digest)
      await this.repository.audit(account.id, 'totp_enrolled', this.now())
      return { ...await this.complete(account, pending.primaryAt, pending.method, this.now(), pending.terms), recoveryCodes }
    })
  }

  async recover(token: string, recoveryCode: string) {
    return this.atomic(async () => {
      const { pending, account } = await this.requirePending(token)
      pending.attempts++
      await this.repository.savePending(pending)
      if (!pending.recoveryEligible || pending.replacing)
        throw new AuthError('recovery_unavailable', 403)
      const security = await this.repository.security(account.id)
      const digest = await this.crypto.digest(recoveryCode)
      if (!security.secret || !security.recoveryHashes.includes(digest))
        throw new AuthError('invalid_code')
      security.recoveryHashes = security.recoveryHashes.filter(h => h !== digest)
      await this.repository.saveSecurity(account.id, security)
      account.securityVersion++
      await this.repository.save(account)
      await this.repository.revoke(account.id)
      await this.repository.deletePending(pending.digest)
      const next = this.crypto.token()
      await this.repository.savePending({ ...pending, digest: await this.crypto.digest(next), replacing: true, attempts: 0, securityVersion: account.securityVersion, expiresAt: this.now() + FIVE_MINUTES })
      await this.repository.audit(account.id, 'recovery_started', this.now())
      return { state: 'enrollment_required' as const, challenge: next }
    })
  }

  async getSession(credential: string): Promise<{
    account: Account
    session: AuthSession
  }> {
    const session = credential ? await this.repository.session(await this.crypto.digest(credential)) : null
    if (!session || session.expiresAt <= this.now() || session.generation !== this.provider.generation)
      throw new AuthError('reauthentication_required', 401)
    const account = await this.repository.get(session.accountId)
    if (!account || account.status !== 'active' || account.securityVersion !== session.securityVersion)
      throw new AuthError('reauthentication_required', 401)
    if (!session.secondAt && ((await this.repository.security(account.id)).secret || await this.policy.requiresTotp(account.id)))
      throw new AuthError('reauthentication_required', 401)
    return { account, session }
  }

  private async requireRecent(credential: string) {
    const { session } = await this.getSession(credential)
    if (this.now() - session.primaryAt > FIVE_MINUTES || (session.secondAt && this.now() - session.secondAt > FIVE_MINUTES))
      throw new AuthError('reauthentication_required', 401)
    return session
  }

  async unlink(credential: string, identifierId: string) {
    return this.atomic(async () => {
      const session = await this.requireRecent(credential)
      const account = (await this.repository.get(session.accountId))!
      const identifier = account.identifiers.find(i => i.id === identifierId)
      if (!identifier)
        throw new AuthError('identifier_not_found', 404)
      const remaining = account.identifiers.filter(i => i.id !== identifierId)
      if (!remaining.some(i => i.recoveryEligible))
        throw new AuthError('recovery_identifier_required')
      account.identifiers = remaining
      account.securityVersion++
      await this.repository.save(account)
      await this.repository.unlinkProvider(identifier.kind, identifier.value)
      await this.repository.revoke(account.id)
      await this.repository.audit(account.id, 'identifier_unlinked', this.now())
    })
  }

  async securityStatus(credential: string) {
    const { account } = await this.getSession(credential)
    return { totpEnabled: !!(await this.repository.security(account.id)).secret, totpRequired: await this.policy.requiresTotp(account.id) }
  }

  async disableTotp(credential: string) {
    return this.atomic(async () => {
      const session = await this.requireRecent(credential)
      if (await this.policy.requiresTotp(session.accountId))
        throw new AuthError('totp_required', 403)
      const account = (await this.repository.get(session.accountId))!
      await this.repository.saveSecurity(account.id, { recoveryHashes: [] })
      account.securityVersion++
      await this.repository.save(account)
      await this.repository.revoke(account.id)
      await this.repository.audit(account.id, 'totp_disabled', this.now())
    })
  }

  async signOut(credential: string, all = false) {
    return this.atomic(async () => {
      const session = all ? await this.requireRecent(credential) : (await this.getSession(credential)).session
      await this.repository.revoke(session.accountId, all ? undefined : session.digest)
    })
  }
}
