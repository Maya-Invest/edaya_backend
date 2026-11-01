/** Application memory bound, independent of the storage provider's object limits. */
export const MAX_STORAGE_READ_BYTES = 25 * 1024 * 1024

export class FileStorageReadError extends Error {
  constructor(readonly code: 'FILE_READ_LIMIT_INVALID' | 'FILE_READ_LIMIT_EXCEEDED' | 'FILE_READ_FAILED') {
    super(code)
    this.name = 'FileStorageReadError'
  }
}

export function assertStorageReadLimit(maxBytes: number): void {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_STORAGE_READ_BYTES) {
    throw new FileStorageReadError('FILE_READ_LIMIT_INVALID')
  }
}

/** Cancel oversized/failed streams and release the reader; Content-Length alone is not trusted. */
export async function readBoundedStorageBody(
  body: { getReader: () => {
    read: () => Promise<{ done: boolean, value?: Uint8Array }>
    cancel: () => Promise<void>
    releaseLock: () => void
  } } | Uint8Array,
  maxBytes: number,
  declaredBytes?: number,
): Promise<Uint8Array> {
  if (body instanceof Uint8Array) {
    assertStorageReadLimit(maxBytes)
    if (body.byteLength > maxBytes || (declaredBytes !== undefined && declaredBytes > maxBytes))
      throw new FileStorageReadError('FILE_READ_LIMIT_EXCEEDED')
    return new Uint8Array(body)
  }

  const reader = body.getReader()
  let completed = false
  try {
    assertStorageReadLimit(maxBytes)
    if (declaredBytes !== undefined && declaredBytes > maxBytes)
      throw new FileStorageReadError('FILE_READ_LIMIT_EXCEEDED')
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        completed = true
        break
      }
      if (!(value instanceof Uint8Array))
        throw new FileStorageReadError('FILE_READ_FAILED')
      size += value.byteLength
      if (size > maxBytes)
        throw new FileStorageReadError('FILE_READ_LIMIT_EXCEEDED')
      if (value.byteLength)
        chunks.push(new Uint8Array(value))
    }
    const result = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.byteLength
    }
    return result
  }
  catch (error) {
    if (error instanceof FileStorageReadError)
      throw error
    throw new FileStorageReadError('FILE_READ_FAILED')
  }
  finally {
    if (!completed)
      await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
