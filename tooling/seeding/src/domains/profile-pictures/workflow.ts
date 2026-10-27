import type { FixtureDataset } from '@edaya/fixtures'
import type { DevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import type { ProfilePicturesSeedPort } from './port'
import { readFile } from 'node:fs/promises'
import { AttachmentOwnerKind } from '@edaya/core'
import { demoCiSchoolOwnerStaffId } from '@edaya/fixtures'
import {
  buildSeedProfileAttachmentId,
  profilePictureForOwner,
  resolveProfilePicturePath,
  SEED_PROFILE_PHOTO_FILE_NAME,
  SEED_PROFILE_PHOTO_MIME_TYPE,
} from '@edaya/fixtures/shared/profile-pictures'

const PROFILE_PHOTO_UPLOAD_CONCURRENCY = 8

export interface SeedDevProfilePicturesOptions {
  apiBaseUrl: string
  onProgress?: () => void
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
  ownerKind: AttachmentOwnerKind.Staff | AttachmentOwnerKind.Guardian | AttachmentOwnerKind.Student | AttachmentOwnerKind.Teacher,
  ownerId: string,
  setPhotoUrl: (photoUrl: string) => Promise<void>,
): Promise<void> {
  const pictureFileName = profilePictureForOwner(ownerKind, ownerId)
  const body = await readFile(resolveProfilePicturePath(pictureFileName))
  const attachmentId = buildSeedProfileAttachmentId(ownerKind, ownerId)

  const uploaded = await port.uploadProfilePhoto({
    attachmentId,
    schoolId,
    ownerKind,
    ownerId,
    fileName: SEED_PROFILE_PHOTO_FILE_NAME,
    mimeType: SEED_PROFILE_PHOTO_MIME_TYPE,
    sizeBytes: body.byteLength,
    body,
    uploadedById: demoCiSchoolOwnerStaffId,
  })

  await setPhotoUrl(uploaded.photoUrl)
}

export async function seedDevProfilePictures(
  port: ProfilePicturesSeedPort,
  options: SeedDevProfilePicturesOptions,
  dataset: FixtureDataset,
): Promise<{ profilePhotos: number }> {
  const staffMembers = dataset.entities.staffMembers ?? []
  const students = dataset.entities.students ?? []
  const guardians = dataset.entities.guardians ?? []
  const teachers = dataset.entities.teachers ?? []
  const targets = [
    ...staffMembers.map(staff => ({
      ownerKind: AttachmentOwnerKind.Staff as const,
      ownerId: staff.id,
      setPhotoUrl: (photoUrl: string) => port.setStaffPhotoUrl(staff.id, photoUrl),
    })),
    ...students.map(student => ({
      ownerKind: AttachmentOwnerKind.Student as const,
      ownerId: student.id,
      setPhotoUrl: (photoUrl: string) => port.setStudentPhotoUrl(student.id, photoUrl),
    })),
    ...guardians.map(guardian => ({
      ownerKind: AttachmentOwnerKind.Guardian as const,
      ownerId: guardian.id,
      setPhotoUrl: (photoUrl: string) => port.setGuardianPhotoUrl(guardian.id, photoUrl),
    })),
    ...teachers.map(teacher => ({
      ownerKind: AttachmentOwnerKind.Teacher as const,
      ownerId: teacher.id,
      setPhotoUrl: (photoUrl: string) => port.setTeacherPhotoUrl(teacher.id, photoUrl),
    })),
  ]

  await mapWithConcurrency(targets, PROFILE_PHOTO_UPLOAD_CONCURRENCY, async (target) => {
    await seedProfilePhotoForOwner(
      port,
      dataset.schoolId,
      target.ownerKind,
      target.ownerId,
      target.setPhotoUrl,
    )
    options.onProgress?.()
  })

  return { profilePhotos: targets.length }
}

/** Re-seeds profile photos for demo login staff only (fast startup repair). */
export async function seedDevDemoStaffProfilePictures(
  port: ProfilePicturesSeedPort,
  context: Pick<DevSeedContext, 'schoolId' | 'staffAccounts' | 'dataset'>,
): Promise<number> {
  const demoStaffIds = new Set(context.staffAccounts.map(account => account.staffId))
  const staffMembers = (context.dataset.entities.staffMembers ?? []).filter(member => demoStaffIds.has(member.id))

  await mapWithConcurrency(staffMembers, PROFILE_PHOTO_UPLOAD_CONCURRENCY, async (staff) => {
    await seedProfilePhotoForOwner(
      port,
      context.schoolId,
      AttachmentOwnerKind.Staff,
      staff.id,
      photoUrl => port.setStaffPhotoUrl(staff.id, photoUrl),
    )
  })

  return staffMembers.length
}
