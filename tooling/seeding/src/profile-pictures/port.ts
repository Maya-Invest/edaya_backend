import type { AttachmentOwnerKind } from '@edaya/core'

export interface UploadProfilePhotoInput {
  attachmentId: string
  schoolId: string
  ownerKind: AttachmentOwnerKind
  ownerId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  body: Uint8Array
  uploadedById?: string
}

export interface ProfilePicturesSeedPort {
  uploadProfilePhoto: (input: UploadProfilePhotoInput) => Promise<{ attachmentId: string, photoUrl: string }>
  setStudentPhotoUrl: (studentId: string, photoUrl: string) => Promise<void>
  setGuardianPhotoUrl: (guardianId: string, photoUrl: string) => Promise<void>
  setStaffPhotoUrl: (staffId: string, photoUrl: string) => Promise<void>
}
