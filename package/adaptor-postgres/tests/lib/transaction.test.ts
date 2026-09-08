import { describe, expect, mock, test } from 'bun:test'
import { PostgresAtomicExecution, transactionContext } from '../../src/lib/transaction'

describe('PostgresAtomicExecution', () => {
  test('runs operations inside a database transaction when none is active', async () => {
    const transaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => fn({ tx: 'outer' }))
    const atomic = new PostgresAtomicExecution({ transaction })

    const result = await atomic.execute(async () => {
      expect(transactionContext.getStore()).toEqual({ tx: 'outer' })
      return 'done'
    })

    expect(result).toBe('done')
    expect(transaction).toHaveBeenCalledTimes(1)
  })

  test('reuses the active transaction context for nested operations', async () => {
    const transaction = mock(async () => {
      throw new Error('should not start a nested transaction')
    })
    const atomic = new PostgresAtomicExecution({ transaction })

    await transactionContext.run({ tx: 'active' }, async () => {
      const result = await atomic.execute(async () => {
        expect(transactionContext.getStore()).toEqual({ tx: 'active' })
        return 'nested'
      })
      expect(result).toBe('nested')
    })

    expect(transaction).not.toHaveBeenCalled()
  })
})
