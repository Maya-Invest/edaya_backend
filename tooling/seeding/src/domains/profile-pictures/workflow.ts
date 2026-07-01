import type { FixtureDataset } from '@edaya/fixtures'
import type { ProfilePicturesSeedPort } from './port'
import { readFile } from 'node:fs/promises'
import { AttachmentOwnerKind } from '@edaya/core'
import { demoSchoolOwnerStaffId } from '@edaya/fixtures'
import {
  buildSeedProfileAttachmentId,
  createRandomProfilePictureAllocator,
  resolveProfilePicturePath,
  SEED_PROFILE_PHOTO_FILE_NAME,
  SEED_PROFILE_PHOTO_MIME_TYPE,
} from '@edaya/fixtures/shared/profile-pictures'

const PROFILE_PHOTO_UPLOAD_CONCURRENCY = 8

export interface SeedDevProfilePicturesOptions {
  apiBaseUrl: string
}

async function mapWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0

  async function runWorker(): Promise<void> {
    while (index < items.length) {
      const current = items[index]!
      index += 1
      await worker(current)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  )
}

async function seedProfilePhotoForOwner(
  port: ProfilePicturesSeedPort,
  schoolId: string,
  ownerKind: AttachmentOwnerKind,
  ownerId: string,
  pickPictureFile: () => string,
  setPhotoUrl: (photoUrl: string) => Promise<void>,
): Promise<void> {
  const pictureFileName = pickPictureFile()
  const body = await readFile(resolveProfilePicturePath(pictureFileName))
  const attachmentId = buildSeedProfileAttachmentId(
    ownerKind === AttachmentOwnerKind.Staff
      ? 'staff'
      : ownerKind === AttachmentOwnerKind.Guardian
        ? 'guardian'
        : 'student',
    ownerId,
  )

  const uploaded = await port.uploadProfilePhoto({
    attachmentId,
    schoolId,
    ownerKind,
    ownerId,
    fileName: SEED_PROFILE_PHOTO_FILE_NAME,
    mimeType: SEED_PROFILE_PHOTO_MIME_TYPE,
    sizeBytes: body.byteLength,
    body,
    uploadedById: demoSchoolOwnerStaffId,
  })

  await setPhotoUrl(uploaded.photoUrl)
}

export async function seedDevProfilePictures(
  port: ProfilePicturesSeedPort,
  _options: SeedDevProfilePicturesOptions,
  dataset: FixtureDataset,
): Promise<{ profilePhotos: number }> {
  const pickPictureFile = createRandomProfilePictureAllocator()
  const staffMembers = dataset.entities.staffMembers ?? []
  const students = dataset.entities.students ?? []
  const guardians = dataset.entities.guardians ?? []
  const targets = [
    ...staffMembers.map(staff => ({
      ownerKind: AttachmentOwnerKind.Staff,
      ownerId: staff.id,
      setPhotoUrl: (photoUrl: string) => port.setStaffPhotoUrl(staff.id, photoUrl),
    })),
    ...students.map(student => ({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: student.id,
      setPhotoUrl: (photoUrl: string) => port.setStudentPhotoUrl(student.id, photoUrl),
    })),
    ...guardians.map(guardian => ({
      ownerKind: AttachmentOwnerKind.Guardian,
      ownerId: guardian.id,
      setPhotoUrl: (photoUrl: string) => port.setGuardianPhotoUrl(guardian.id, photoUrl),
    })),
  ]

  await mapWithConcurrency(targets, PROFILE_PHOTO_UPLOAD_CONCURRENCY, async (target) => {
    await seedProfilePhotoForOwner(
      port,
      dataset.schoolId,
      target.ownerKind,
      target.ownerId,
      pickPictureFile,
      target.setPhotoUrl,
    )
  })

  return { profilePhotos: targets.length }
}
