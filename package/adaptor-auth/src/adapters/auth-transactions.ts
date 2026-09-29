import type { SQL } from 'drizzle-orm'
import { AsyncLocalStorage } from 'node:async_hooks'
import { sql } from 'drizzle-orm'

interface AuthDatabase {
  execute: (query: SQL) => Promise<unknown>
  transaction: <T>(work: (tx: AuthDatabase) => Promise<T>) => Promise<T>
}

/** A separate context from school transactions: the databases may differ. */
export function createAuthTransactions(database: unknown) {
  const root = database as AuthDatabase
  const context = new AsyncLocalStorage<AuthDatabase>()
  const db = new Proxy(root, {
    get(_target, key) {
      const active = context.getStore() ?? root
      // Provider adapter transactions join the surrounding protocol transaction.
      if (key === 'transaction')
        return <T>(work: (tx: AuthDatabase) => Promise<T>) => context.getStore() ? work(active) : root.transaction(work)
      const value = Reflect.get(active, key)
      return typeof value === 'function' ? value.bind(active) : value
    },
  })

  return {
    db,
    async execute<T>(work: () => Promise<T>): Promise<T> {
      if (context.getStore())
        return work()
      return root.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL lock_timeout = '5s'`)
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('edaya:auth-protocol', 0))`)
        return context.run(tx, work)
      })
    },
  }
}
