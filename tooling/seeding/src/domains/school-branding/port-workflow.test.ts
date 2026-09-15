import type { SchoolIssuingIdentitySeedRecord, SchoolBrandingSeedPort, UploadSchoolIssuanceAssetInput } from './port'
import { demoDataset } from '@edaya/fixtures'
import { SEED_ISSUANCE_ASSETS, SEED_PUBLIC_BRANDING_PURPOSES } from '@edaya/fixtures/shared/issuance-assets'
import { describe, expect, test } from 'bun:test'
import { seedDevSchoolBranding } from './workflow'

function createMemoryPort(): {
  port: SchoolBrandingSeedPort
  identity: SchoolIssuingIdentitySeedRecord[]
  uploads: UploadSchoolIssuanceAssetInput[]
} {
  const identity: SchoolIssuingIdentitySeedRecord[] = []
  const uploads: UploadSchoolIssuanceAssetInput[] = []
  return {
    identity,
    uploads,
    port: {
      updateIssuingIdentity: async (record) => {
        identity.push(record)
      },
      uploadIssuanceAsset: async (input) => {
        uploads.push(input)
      },
    },
  }
}

describe('school branding seed workflow', () => {
  test('uploads restricted assets then allowlists logo and crest with issuing identity', async () => {
    const memory = createMemoryPort()
    const result = await seedDevSchoolBranding(memory.port, demoDataset)

    expect(result.assets).toBe(SEED_ISSUANCE_ASSETS.length)
    expect(memory.uploads.map(upload => upload.purpose)).toEqual(SEED_ISSUANCE_ASSETS.map(asset => asset.purpose))
    expect(memory.identity).toHaveLength(1)
    expect(memory.identity[0]).toMatchObject({
      schoolId: demoDataset.schoolId,
      issuingName: demoDataset.entities.school?.issuingName,
      schoolCode: demoDataset.entities.school?.schoolCode,
      publicBrandingPurposes: [...SEED_PUBLIC_BRANDING_PURPOSES],
    })
    expect(memory.uploads.every(upload => upload.schoolId === demoDataset.schoolId)).toBe(true)
    expect(memory.uploads.find(upload => upload.purpose === 'school.stamp')?.fileName).toBe('stamp.jpg')
  })
})
