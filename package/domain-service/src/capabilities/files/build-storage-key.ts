import type { AttachmentOwnerKind } from '@edaya/core'
import { sanitizeFileName } from './sanitize-file-name'

export type StoragePurpose
  = | 'uploads'
    | 'generated/report-card'
    | 'generated/logbook'
    | 'generated/incident-report'

export interface BuildStorageKeyInput {
  schoolId: string
  purpose: StoragePurpose
  ownerKind: AttachmentOwnerKind
  ownerId: string
  attachmentId: string
  fileName: string
}

export function buildStorageKey(input: BuildStorageKeyInput): string {
  const safeFileName = sanitizeFileName(input.fileName)
  return [
    input.schoolId,
    input.purpose,
    input.ownerKind,
    input.ownerId,
    input.attachmentId,
    safeFileName,
  ].join('/')
}
