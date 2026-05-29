import { describe, expect, it } from 'bun:test'
import { InMemoryStore } from '../../src/in-memory-store'
import { InMemoryAtomicExecution } from '../../src/in-memory-repositories'

interface SampleEntity {
  readonly id: string
  readonly value: string
}

describe('In-memory store atomic transactions', () => {
  it('commits changes to all stores on successful operation', async () => {
    const store1 = new InMemoryStore<SampleEntity>()
    const store2 = new InMemoryStore<SampleEntity>()
    const execution = new InMemoryAtomicExecution([store1, store2])

    await execution.execute(async () => {
      await store1.save({ id: 'a', value: 'value-a' })
      await store2.save({ id: 'b', value: 'value-b' })
    })

    expect(await store1.findById('a')).toEqual({ id: 'a', value: 'value-a' })
    expect(await store2.findById('b')).toEqual({ id: 'b', value: 'value-b' })
  })

  it('rolls back all stores to their snapshot state when operation throws', async () => {
    const store1 = new InMemoryStore<SampleEntity>()
    const store2 = new InMemoryStore<SampleEntity>()
    const execution = new InMemoryAtomicExecution([store1, store2])

    // Put initial states
    await store1.save({ id: 'initial', value: 'original' })

    try {
      await execution.execute(async () => {
        await store1.save({ id: 'initial', value: 'changed' })
        await store2.save({ id: 'new-temp', value: 'temporary' })
        throw new Error('Simulated atomic failure')
      })
    }
    catch (e: any) {
      expect(e.message).toBe('Simulated atomic failure')
    }

    // Verify store1 has rolled back to 'original'
    expect(await store1.findById('initial')).toEqual({ id: 'initial', value: 'original' })
    // Verify store2 remains completely empty
    expect(await store2.findById('new-temp')).toBeUndefined()
  })
})
