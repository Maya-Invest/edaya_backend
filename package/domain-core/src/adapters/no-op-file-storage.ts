import type { FileStoragePort } from '../ports/gateways/file-storage'
import { assertStorageReadLimit } from '../shared/bounded-storage-read'

export const noOpFileStorage: FileStoragePort = {
  putObject: async () => ({ sizeBytes: 0 }),
  deleteObject: async () => {},
  headObject: async () => null,
  readObject: async (_key, { maxBytes }) => {
    assertStorageReadLimit(maxBytes)
    return null
  },
  createPresignedUpload: async input => ({
    key: input.key,
    uploadUrl: `noop://upload/${encodeURIComponent(input.key)}`,
    expiresAt: new Date(Date.now() + 60_000),
    headers: { 'Content-Type': input.contentType },
  }),
  createPresignedDownload: async (_key, options) => ({
    downloadUrl: `noop://download/${encodeURIComponent(options?.fileName ?? 'file')}`,
    expiresAt: new Date(Date.now() + 60_000),
  }),
}
