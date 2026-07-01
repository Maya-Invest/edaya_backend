import type { PutObjectInput } from '../../ports/gateways/file-storage'

export async function readStorageBody(body: PutObjectInput['body']): Promise<Uint8Array> {
  if (body instanceof Uint8Array) {
    return body
  }
  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body)
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let totalLength = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    if (value) {
      chunks.push(value)
      totalLength += value.byteLength
    }
  }

  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}
