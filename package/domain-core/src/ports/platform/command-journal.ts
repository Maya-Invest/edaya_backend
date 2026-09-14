export type CommandJson = null | boolean | number | string | CommandJson[] | { [key: string]: CommandJson }

/** Supplied by trusted admission, never copied from client-selected authority. */
export interface CommandReceiptScope {
  schoolId: string
  command: string
  callerId: string
  requestId: string
}

export interface CommandReceipt extends CommandReceiptScope {
  id: string
  requestDigest: string
  resultMode: 'ordinary' | 'secret-display'
  status: 'claimed' | 'completed'
  /** Explicit, non-secret projection; secret-display results never enter this field. */
  result: CommandJson | null
}

export interface CommandAuditFact {
  event: string
  resourceType: string
  resourceId: string
}

/** Durable references only. Handlers load and authorize authoritative domain state. */
export interface CommandOutboxFact {
  id: string
  kind: string
  version: number
  resourceType: string
  resourceId: string
}

/** Every call must use the current AtomicExecutionPort transaction. */
export interface CommandJournalPort {
  find: (scope: CommandReceiptScope) => Promise<CommandReceipt | undefined>
  claim: (receipt: CommandReceipt) => Promise<void>
  complete: (receipt: CommandReceipt, audit: readonly CommandAuditFact[], outbox: readonly CommandOutboxFact[]) => Promise<void>
}
