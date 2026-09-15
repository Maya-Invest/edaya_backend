import type { SchoolIssuanceAssetPurpose, SchoolPublicBrandingPurpose } from '@edaya/core'

export interface SchoolIssuingIdentitySeedRecord {
  schoolId: string
  issuingName?: string
  postalAddress?: string
  phone?: string
  email?: string
  schoolCode?: string
  publicBrandingPurposes: readonly SchoolPublicBrandingPurpose[]
}

export interface UploadSchoolIssuanceAssetInput {
  schoolId: string
  purpose: SchoolIssuanceAssetPurpose
  attachmentId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  body: Uint8Array
}

export interface SchoolBrandingSeedPort {
  updateIssuingIdentity: (record: SchoolIssuingIdentitySeedRecord) => Promise<void>
  uploadIssuanceAsset: (input: UploadSchoolIssuanceAssetInput) => Promise<void>
}
