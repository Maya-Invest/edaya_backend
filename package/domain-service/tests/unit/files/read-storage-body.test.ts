import { readStorageBody } from '@edaya/service'
import { describe, expect, test } from 'bun:test'

describe('readStorageBody', () => {
  test('returns Uint8Array inputs unchanged', async () => {
    const body = new Uint8Array([1, 2, 3])
    const result = await readStorageBody(body)
    expect(result).toBe(body)
  })

  test('copies ArrayBuffer inputs into a Uint8Array', async () => {
    const buffer = new Uint8Array([4, 5, 6]).buffer
    const result = await readStorageBody(buffer)
    expect(result).toEqual(new Uint8Array([4, 5, 6]))
  })

  test('merges ReadableStream chunks into one Uint8Array', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]))
        controller.enqueue(new Uint8Array([3]))
        controller.close()
      },
    })

    const result = await readStorageBody(stream)
    expect(result).toEqual(new Uint8Array([1, 2, 3]))
  })
})
