import { fileURLToPath, URL } from 'node:url'

/** Synthetic bytes for legacy demo metadata; never fetch fixture placeholder URLs. */
export function resolveAttachmentFixturePath(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg': return fileURLToPath(new URL('../../assets/profile-pictures/pic0001.jpg', import.meta.url))
    case 'application/pdf': return fileURLToPath(new URL('../../assets/attachments/sample.pdf', import.meta.url))
    default: throw new Error('No attachment byte fixture for this MIME type')
  }
}
