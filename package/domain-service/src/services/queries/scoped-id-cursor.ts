import { DomainValidationError } from '@edaya/core'

export async function scopedIdCursor(identity: readonly unknown[], token: string | undefined, message: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(identity))))
  const signature = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')
  const encode = (id: string) => JSON.stringify([signature, id])
  if (token === undefined)
    return { after: undefined, encode }
  try {
    const parts: unknown = JSON.parse(token)
    if (Array.isArray(parts) && parts.length === 2 && parts[0] === signature && typeof parts[1] === 'string' && parts[1])
      return { after: parts[1], encode }
  }
  catch {}
  throw new DomainValidationError(message)
}
