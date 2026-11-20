import type { AtomicExecutionPort, CommandAuditFact, CommandJournalPort, CommandJson, CommandOutboxFact, CommandReceipt, CommandReceiptScope } from '@edaya/core'
import { BusinessRuleViolationError } from '@edaya/core'

/** Canonical JSON for already validated command input, including parsed dates. */
export function normalizeCommandRequest(input: unknown): string {
  const ancestors = new Set<object>()
  function encode(value: unknown): string {
    if (value === null || typeof value === 'string' || typeof value === 'boolean')
      return JSON.stringify(value)
    if (typeof value === 'number' && Number.isFinite(value))
      return JSON.stringify(value)
    if (value instanceof Date && Number.isFinite(value.getTime()))
      return JSON.stringify(value.toISOString())
    if (typeof value !== 'object' || value === null || ancestors.has(value))
      throw new BusinessRuleViolationError('COMMAND_INPUT_INVALID', 'Command input must be finite, acyclic JSON')
    ancestors.add(value)
    try {
      if (Array.isArray(value))
        return `[${Array.from(value, item => encode(item)).join(',')}]`
      if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
        throw new BusinessRuleViolationError('COMMAND_INPUT_INVALID', 'Command input must contain plain objects')
      const object = value as Record<string, unknown>
      return `{${Object.keys(object).filter(key => object[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${encode(object[key])}`).join(',')}}`
    }
    finally { ancestors.delete(value) }
  }
  return encode(input)
}

export async function digestCommandRequest(input: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeCommandRequest(input))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export interface ExecuteCommandInput<Result, Stored extends CommandJson> {
  scope: CommandReceiptScope
  input: unknown
  resultMode: CommandReceipt['resultMode']
  lockKeys?: readonly string[]
  /** Current permissions AND all write targets. Called inside the transaction, including on replay. */
  authorize: () => Promise<void>
  /** Current resource/relationship checks before disclosing the saved result. */
  replay: (stored: Stored) => Promise<Result>
  execute: () => Promise<Result>
  /** Mandatory allowlist projection. Never persist a secret, credential or private byte payload. */
  persistResult: (result: Result) => Stored
  audit: (result: Result) => readonly CommandAuditFact[]
  outbox?: (result: Result) => readonly CommandOutboxFact[]
}

/** Reliability around existing named workflows, not a second workflow dispatcher. */
export class CommandExecution {
  constructor(private readonly atomic: AtomicExecutionPort, private readonly journal: CommandJournalPort) {}

  async wasDelivered(scope: CommandReceiptScope, input: unknown) {
    const receipt = await this.atomic.execute(() => this.journal.find(scope))
    if (!receipt)
      return false
    if (receipt.requestDigest !== await digestCommandRequest(input) || receipt.status !== 'completed')
      throw new BusinessRuleViolationError('COMMAND_REPLAY_CONFLICT', 'The queued request needs review')
    return true
  }

  async execute<Result, Stored extends CommandJson>(options: ExecuteCommandInput<Result, Stored>): Promise<Result> {
    for (const value of [options.scope.schoolId, options.scope.command, options.scope.callerId, options.scope.requestId]) {
      if (typeof value !== 'string' || !value.trim() || value.length > 200)
        throw new BusinessRuleViolationError('COMMAND_SCOPE_INVALID', 'Command identity is required and bounded')
    }
    const requestDigest = await digestCommandRequest(options.input)
    // JSON tuple avoids ambiguous delimiter-based namespaces.
    const receiptLock = `command-receipt:${normalizeCommandRequest([
      options.scope.schoolId,
      options.scope.command,
      options.scope.callerId,
      options.scope.requestId,
    ])}`
    return this.atomic.execute(async () => {
      await options.authorize()
      const existing = await this.journal.find(options.scope)
      if (existing) {
        if (existing.requestDigest !== requestDigest || existing.resultMode !== options.resultMode)
          throw new BusinessRuleViolationError('COMMAND_REPLAY_CONFLICT', 'Request identity was already used with different input')
        if (existing.status !== 'completed')
          throw new BusinessRuleViolationError('COMMAND_INCOMPLETE', 'Command receipt is not complete')
        return options.replay(existing.result as Stored)
      }
      const receipt: CommandReceipt = {
        ...options.scope,
        id: crypto.randomUUID(),
        requestDigest,
        resultMode: options.resultMode,
        status: 'claimed',
        result: null,
      }
      await this.journal.claim(receipt)
      const result = await options.execute()
      // Round-trip the projection now; serialization failures must roll back the business write.
      const stored = JSON.parse(normalizeCommandRequest(options.persistResult(result))) as Stored
      const audit = options.audit(result)
      if (!audit.length)
        throw new BusinessRuleViolationError('COMMAND_AUDIT_REQUIRED', 'A completed command requires an audit fact')
      await this.journal.complete({ ...receipt, status: 'completed', result: stored }, audit, options.outbox?.(result) ?? [])
      return result
    }, { lockKeys: [receiptLock, ...options.lockKeys ?? []] })
  }
}
