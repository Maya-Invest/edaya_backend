import type { FileStoragePort } from '../../src/ports'

/** Test-only no-op storage — kept in core to avoid a circular dep on @edaya/adaptor-file. */
export const testFileStorage: FileStoragePort = {
  putObject: async () => ({ sizeBytes: 0 }),
  deleteObject: async () => {},
  headObject: async () => null,
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
