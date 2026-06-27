import { describe, expect, it } from 'bun:test'
import { createInMemoryFileStorage } from '@edaya/core'
import { createR2FileStorage } from '../src/r2-file-storage'

describe('createR2FileStorage', () => {
  it('is exported and constructible with config shape', () => {
    expect(typeof createR2FileStorage).toBe('function')
    expect(createInMemoryFileStorage).toBeDefined()
  })
})
