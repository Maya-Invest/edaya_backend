import { describe, expect, test } from 'bun:test'
import { conversationsQuerySchema } from '../../../src/domain/messaging/conversation'

describe('conversation search query', () => {
  test('normalizes bounded optional text without changing existing paging defaults', () => {
    expect(conversationsQuerySchema.parse({ search: '  Tuition 100%_  ' })).toEqual({ search: 'Tuition 100%_', order: 'latest', offset: 0, limit: 25 })
    expect(conversationsQuerySchema.parse({})).toEqual({ order: 'latest', offset: 0, limit: 25 })
  })
  test('rejects oversized and non-text search values', () => {
    expect(conversationsQuerySchema.safeParse({ search: 'x'.repeat(201) }).success).toBe(false)
    expect(conversationsQuerySchema.safeParse({ search: 42 }).success).toBe(false)
  })
})
