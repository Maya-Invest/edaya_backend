import type { AtomicExecutionPort } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { AsyncLocalStorage } from 'node:async_hooks'
import { sql } from 'drizzle-orm'

export const transactionContext = new AsyncLocalStorage<unknown>()

export interface PostgresTransactionalDb {
  transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>
}

export class PostgresAtomicExecution implements AtomicExecutionPort {
  constructor(private readonly db: PostgresTransactionalDb) {}

  async execute<T>(operation: () => Promise<T>, options?: { lockKeys?: readonly string[] }): Promise<T> {
    const run = async (tx: unknown) => {
      // Stable ordering and transaction-scoped locks work across API instances.
      // Hash collisions only serialize unrelated operations; they cannot bypass a lock.
      for (const key of [...new Set(options?.lockKeys ?? [])].sort()) {
        await (tx as { execute: (query: SQL) => Promise<unknown> })
          .execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`)
      }
      return operation()
    }
    const activeTransaction = transactionContext.getStore()
    if (activeTransaction) {
      return await run(activeTransaction)
    }

    return await this.db.transaction(async (tx) => {
      return await transactionContext.run(tx, async () => {
        return await run(tx)
      })
    }) as T
  }
}
