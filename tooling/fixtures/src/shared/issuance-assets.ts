import type { SchoolIssuanceAssetPurpose, SchoolPublicBrandingPurpose } from '@edaya/core'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SCHOOL_CREST_PURPOSE,
  SCHOOL_LOGO_PURPOSE,
  SCHOOL_PUBLIC_BRANDING_PURPOSES,
  SCHOOL_SIGNATURE_PURPOSE,
  SCHOOL_STAMP_PURPOSE,
} from '@edaya/core'

export const SEED_ISSUANCE_ASSET_MIME_TYPE = 'image/jpeg'
export const SEED_PUBLIC_BRANDING_PURPOSES: readonly SchoolPublicBrandingPurpose[] = SCHOOL_PUBLIC_BRANDING_PURPOSES

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
export const DEV_FIXTURES_BRANDING_DIR = path.resolve(packageRoot, '../../assets/branding')

export const SEED_ISSUANCE_ASSETS = [
  { purpose: SCHOOL_LOGO_PURPOSE, fileName: 'logo.jpg' },
  { purpose: SCHOOL_CREST_PURPOSE, fileName: 'crest.jpg' },
  { purpose: SCHOOL_STAMP_PURPOSE, fileName: 'stamp.jpg' },
  { purpose: SCHOOL_SIGNATURE_PURPOSE, fileName: 'signature.jpg' },
] as const satisfies readonly { purpose: SchoolIssuanceAssetPurpose, fileName: string }[]

export function resolveIssuanceAssetPath(fileName: string): string {
  return path.join(DEV_FIXTURES_BRANDING_DIR, fileName)
}

export function buildSeedIssuanceAttachmentId(schoolId: string, purpose: SchoolIssuanceAssetPurpose): string {
  return `att-seed-${schoolId}-${purpose.replace('.', '-')}`
}
