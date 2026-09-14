import { Buffer } from 'node:buffer'
import { describe, expect, it, mock } from 'bun:test'
import { createInMemoryFileStorage, MAX_STORAGE_READ_BYTES, readBoundedStorageBody } from '../../../src'

describe('bounded private object reads', () => {
  it('copies complete bytes and rejects invalid or exceeded bounds', async () => {
    const storage = createInMemoryFileStorage()
    await storage.putObject({ key: 'asset', body: new Uint8Array([1, 2, 3]), contentType: 'image/png' })
    const result = await storage.readObject('asset', { maxBytes: 3 })
    expect(result).toEqual({ body: new Uint8Array([1, 2, 3]), sizeBytes: 3, contentType: 'image/png' })
    result!.body[0] = 9
    expect((await storage.readObject('asset', { maxBytes: 3 }))!.body[0]).toBe(1)
    await expect(storage.readObject('missing', { maxBytes: 3 })).resolves.toBeNull()
    await expect(storage.readObject('asset', { maxBytes: 2 })).rejects.toThrow('FILE_READ_LIMIT_EXCEEDED')
    for (const maxBytes of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_STORAGE_READ_BYTES + 1])
      await expect(storage.readObject('missing', { maxBytes })).rejects.toThrow('FILE_READ_LIMIT_INVALID')
  })

  it('does not trust absent or understated content length and cancels on overflow', async () => {
    for (const declared of [undefined, 1]) {
      const cancel = mock(() => {})
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]))
          controller.enqueue(new Uint8Array([3, 4]))
        },
        cancel,
      })
      await expect(readBoundedStorageBody(stream, 3, declared)).rejects.toThrow('FILE_READ_LIMIT_EXCEEDED')
      expect(cancel).toHaveBeenCalledTimes(1)
      expect(stream.locked).toBe(false)
    }
  })

  it('copies Buffer input and reused stream buffers instead of retaining slice views', async () => {
    const source = Buffer.from([1, 2])
    const result = await readBoundedStorageBody(source, 2)
    source[0] = 9
    expect(result).toEqual(new Uint8Array([1, 2]))
    let step = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (step++ === 0) {
          controller.enqueue(source)
        }
        else {
          source[0] = 7
          controller.close()
        }
      },
    }, { highWaterMark: 0 })
    await expect(readBoundedStorageBody(stream, 2)).resolves.toEqual(new Uint8Array([9, 2]))
  })

  it('cancels early for declared oversized objects and invalid bounds', async () => {
    for (const [bound, declared, code] of [[3, 4, 'FILE_READ_LIMIT_EXCEEDED'], [0, 1, 'FILE_READ_LIMIT_INVALID']] as const) {
      const cancel = mock(() => {})
      const stream = new ReadableStream<Uint8Array>({ cancel })
      await expect(readBoundedStorageBody(stream, bound, declared)).rejects.toThrow(code)
      expect(cancel).toHaveBeenCalledTimes(1)
      expect(stream.locked).toBe(false)
    }
  })

  it('accepts exact-limit streams and redacts underlying read errors', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]))
        controller.enqueue(new Uint8Array([3]))
        controller.close()
      },
    })
    await expect(readBoundedStorageBody(stream, 3)).resolves.toEqual(new Uint8Array([1, 2, 3]))
    expect(stream.locked).toBe(false)
    const failed = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error('signed-url-and-private-key')
      },
    })
    await expect(readBoundedStorageBody(failed, 3)).rejects.toThrow('FILE_READ_FAILED')
    expect(failed.locked).toBe(false)
  })
})
