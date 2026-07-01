import type { ProfilePicturesSeedPort } from './port'
import { readFile } from 'node:fs/promises'
import { AttachmentOwnerKind } from '@edaya/core'
import {
  buildSeedProfileAttachmentId,
  createRandomProfilePictureAllocator,
  resolveProfilePicturePath,
  SEED_GUARDIANS,
  SEED_PROFILE_PHOTO_FILE_NAME,
  SEED_PROFILE_PHOTO_MIME_TYPE,
  SEED_SCHOOL_ID,
  SEED_SCHOOL_OWNER_STAFF_ID,
  SEED_STAFF,
  SEED_STUDENTS,
} from '@edaya/fixtures'

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
    schoolId: SEED_SCHOOL_ID,
    ownerKind,
    ownerId,
    fileName: SEED_PROFILE_PHOTO_FILE_NAME,
    mimeType: SEED_PROFILE_PHOTO_MIME_TYPE,
    sizeBytes: body.byteLength,
    body,
    uploadedById: SEED_SCHOOL_OWNER_STAFF_ID,
  })

  await setPhotoUrl(uploaded.photoUrl)
}

export async function seedDevProfilePictures(
  port: ProfilePicturesSeedPort,
  _options: SeedDevProfilePicturesOptions,
): Promise<{ profilePhotos: number }> {
  const pickPictureFile = createRandomProfilePictureAllocator()
  const targets = [
    ...SEED_STAFF.map(staff => ({
      ownerKind: AttachmentOwnerKind.Staff,
      ownerId: staff.id,
      setPhotoUrl: (photoUrl: string) => port.setStaffPhotoUrl(staff.id, photoUrl),
    })),
    ...SEED_STUDENTS.map(student => ({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: student.id,
      setPhotoUrl: (photoUrl: string) => port.setStudentPhotoUrl(student.id, photoUrl),
    })),
    ...SEED_GUARDIANS.map(guardian => ({
      ownerKind: AttachmentOwnerKind.Guardian,
      ownerId: guardian.id,
      setPhotoUrl: (photoUrl: string) => port.setGuardianPhotoUrl(guardian.id, photoUrl),
    })),
  ]

  await mapWithConcurrency(targets, PROFILE_PHOTO_UPLOAD_CONCURRENCY, async (target) => {
    await seedProfilePhotoForOwner(
      port,
      target.ownerKind,
      target.ownerId,
      pickPictureFile,
      target.setPhotoUrl,
    )
  })

  return { profilePhotos: targets.length }
}
