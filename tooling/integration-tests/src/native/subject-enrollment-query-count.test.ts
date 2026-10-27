import { expect, test } from 'bun:test'
import { measureCompulsoryPersistence } from './support/subject-enrollment-measurement'

test('compulsory enrollment batching reduces queries without changing persisted results', async () => {
  const results = await measureCompulsoryPersistence(3)
  expect(results[1]!.calls).toBeLessThan(results[0]!.calls * 0.75)
}, 30000)
