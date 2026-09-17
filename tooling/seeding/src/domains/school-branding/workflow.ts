import type { FixtureDataset } from '@edaya/fixtures'
import type { SchoolBrandingSeedPort } from './port'
import { readFile } from 'node:fs/promises'
import {
  buildSeedIssuanceAttachmentId,
  resolveIssuanceAssetPath,
  SEED_ISSUANCE_ASSET_MIME_TYPE,
  SEED_ISSUANCE_ASSETS,
  SEED_PUBLIC_BRANDING_PURPOSES,
} from '@edaya/fixtures/shared/issuance-assets'

export async function seedDevSchoolBranding(
  port: SchoolBrandingSeedPort,
  dataset: FixtureDataset,
): Promise<{ assets: number }> {
  const school = dataset.entities.school
  if (!school) {
    throw new Error('Fixture dataset must include school for branding seeding')
  }

  for (const asset of SEED_ISSUANCE_ASSETS) {
    const body = new Uint8Array(await readFile(resolveIssuanceAssetPath(asset.fileName)))
    await port.uploadIssuanceAsset({
      schoolId: school.id,
      purpose: asset.purpose,
      attachmentId: buildSeedIssuanceAttachmentId(school.id, asset.purpose),
      fileName: asset.fileName,
      mimeType: SEED_ISSUANCE_ASSET_MIME_TYPE,
      sizeBytes: body.byteLength,
      body,
    })
  }

  await port.updateIssuingIdentity({
    schoolId: school.id,
    issuingName: school.issuingName ?? undefined,
    postalAddress: school.postalAddress ?? undefined,
    phone: school.phone ?? undefined,
    email: school.email ?? undefined,
    schoolCode: school.schoolCode ?? undefined,
    publicBrandingPurposes: SEED_PUBLIC_BRANDING_PURPOSES,
  })

  return { assets: SEED_ISSUANCE_ASSETS.length }
}
