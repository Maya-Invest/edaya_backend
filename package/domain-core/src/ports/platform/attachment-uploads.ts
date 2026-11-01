import type { AttachmentData } from '../../domain/school/attachment'

/** Internal immutable admission record; never exposed as a generic entity. */
export interface AttachmentUploadIntent {
  attachmentId: string
  schoolId: string
  callerId: string
  attachment: AttachmentData
  expiresAt: Date
  completedStorageKey?: string
  checksum?: string
}

export interface AttachmentUploadStore {
  /** Admission of a temporary local PUT capability; exact unguessable staging key only. */
  findPendingByStorageKey: (storageKey: string) => Promise<AttachmentUploadIntent | undefined>
  find: (schoolId: string, attachmentId: string) => Promise<AttachmentUploadIntent | undefined>
  create: (intent: AttachmentUploadIntent) => Promise<void>
  complete: (schoolId: string, attachmentId: string, storageKey: string, checksum: string) => Promise<void>
}
