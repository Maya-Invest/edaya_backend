import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SEED_PROFILE_PHOTO_FILE_NAME = 'profile.jpg'
export const SEED_PROFILE_PHOTO_MIME_TYPE = 'image/jpeg'
export const PROFILE_PICTURE_FILE_PATTERN = /^pic\d{4}\.jpg$/i

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
export const DEV_FIXTURES_PICTURES_DIR = path.resolve(packageRoot, '../../assets/profile-pictures')

let cachedPictureFiles: readonly string[] | undefined

export function listProfilePictureFiles(): readonly string[] {
  if (cachedPictureFiles) {
    return cachedPictureFiles
  }

  cachedPictureFiles = Object.freeze(
    readdirSync(DEV_FIXTURES_PICTURES_DIR)
      .filter(fileName => PROFILE_PICTURE_FILE_PATTERN.test(fileName))
      .sort((left, right) => left.localeCompare(right)),
  )

  if (cachedPictureFiles.length === 0) {
    throw new Error(`No profile picture fixtures found in ${DEV_FIXTURES_PICTURES_DIR}`)
  }

  return cachedPictureFiles
}

function shuffleInPlace<T>(items: T[]): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = items[index]!
    items[index] = items[swapIndex]!
    items[swapIndex] = current
  }
}

/** Returns a shuffled allocator that cycles through the full fixture pool before reshuffling. */
export function createRandomProfilePictureAllocator(): () => string {
  const pictures = [...listProfilePictureFiles()]
  let pool = [...pictures]
  shuffleInPlace(pool)
  let nextIndex = 0

  return () => {
    if (nextIndex >= pool.length) {
      pool = [...pictures]
      shuffleInPlace(pool)
      nextIndex = 0
    }

    const picture = pool[nextIndex]!
    nextIndex += 1
    return picture
  }
}

export function resolveProfilePicturePath(fileName: string): string {
  return path.join(DEV_FIXTURES_PICTURES_DIR, fileName)
}

export function buildSeedProfileAttachmentId(ownerKind: 'student' | 'guardian' | 'staff' | 'teacher', ownerId: string): string {
  return `att-prof-${ownerKind}-${ownerId}`
}
