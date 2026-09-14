import type { ClaimedDurableWork, DurableWorkPort } from '@edaya/core'

export class DurableWorkFailure extends Error {
  constructor(readonly code: string, readonly permanent = false) {
    super(code)
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(code))
      throw new Error('Work failures require a stable code')
  }
}

/** Feature owners register handlers here only after their domain contracts exist. */
export interface DurableWorkHandler {
  version: number
  /** Load school/resource state from these durable references and enforce current lifecycle/authority. */
  run: (work: ClaimedDurableWork) => Promise<void>
}

export async function runDurableWorkBatch(
  workStore: DurableWorkPort,
  handlers: Readonly<Record<string, DurableWorkHandler>>,
  options: { limit?: number, leaseMs?: number } = {},
): Promise<{ completed: number, failed: number, lostLease: number }> {
  const work = await workStore.claim({ kinds: Object.keys(handlers), limit: options.limit ?? 25, leaseMs: options.leaseMs ?? 60000 })
  const counts = { completed: 0, failed: 0, lostLease: 0 }
  // A bounded batch starts all its handlers promptly rather than expiring leases
  // on later items while waiting for a slow renderer at the front of the batch.
  const results = await Promise.allSettled(work.map(async (item) => {
    try {
      const handler = handlers[item.kind]
      if (!handler || handler.version !== item.version)
        throw new DurableWorkFailure('WORK_VERSION_UNSUPPORTED', true)
      await handler.run(item)
      if (await workStore.complete(item))
        counts.completed++
      else
        counts.lostLease++
    }
    catch (error) {
      // Provider exception text can include credentials or private input. Persist
      // only a typed stable code; unclassified failures remain retryable.
      const code = error instanceof DurableWorkFailure ? error.code : 'WORK_HANDLER_FAILED'
      const permanent = error instanceof DurableWorkFailure && error.permanent
      if (await workStore.fail(item, { code, permanent }))
        counts.failed++
      else
        counts.lostLease++
    }
  }))
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (failures.length)
    throw new AggregateError(failures.map(result => result.reason), 'Durable work persistence failed')
  return counts
}
