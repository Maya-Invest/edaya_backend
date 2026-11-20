import type { CommandOutboxFact } from './command-journal'

export interface ClaimedDurableWork extends CommandOutboxFact {
  schoolId: string
  receiptId: string
  leaseId: string
  attempts: number
}

export interface DurableWorkState {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'dead'
  retryAt: Date | null
}

export interface DurableWorkPort {
  getState: (id: string) => Promise<DurableWorkState | null>
  /** Atomically claim committed work. Never call from a business transaction. */
  claim: (input: { kinds: readonly string[], jobId?: string, limit: number, leaseMs: number }) => Promise<ClaimedDurableWork[]>
  /** Only the current unexpired lease may change delivery state. */
  complete: (work: ClaimedDurableWork) => Promise<boolean>
  fail: (work: ClaimedDurableWork, failure: { code: string, permanent: boolean }) => Promise<boolean>
  /** Long-running handlers renew before expiry; expiry cannot be retroactively extended. */
  renew: (work: ClaimedDurableWork, leaseMs: number) => Promise<boolean>
}
