import type { AtomicExecutionPort } from '@edaya/core'
import { AsyncLocalStorage } from 'node:async_hooks'

export const transactionContext = new AsyncLocalStorage<unknown>()

export interface PostgresTransactionalDb {
  transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>
}

export class PostgresAtomicExecution implements AtomicExecutionPort {
  constructor(private readonly db: PostgresTransactionalDb) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const activeTransaction = transactionContext.getStore()
    if (activeTransaction) {
      return await operation()
    }

    return await this.db.transaction(async (tx) => {
      return await transactionContext.run(tx, async () => {
        return await operation()
      })
    }) as T
  }
}
