import type { AttachmentOwnerKind } from '@edaya/core'

export interface AttachmentSeedRecord {
  id: string
  schoolId: string
  ownerKind: AttachmentOwnerKind
  ownerId: string
  fileName: string
  fileUrl: string
  mimeType?: string
  sizeBytes?: number
  uploadedById?: string
  createdAt: string
}

export interface AttachmentsSeedPort {
  saveAttachment: (record: AttachmentSeedRecord) => Promise<void>
}
