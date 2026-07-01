import { describe, expect, test } from 'bun:test'
import {
  createRandomProfilePictureAllocator,
  listProfilePictureFiles,
  PROFILE_PICTURE_FILE_PATTERN,
} from '../../src/shared/profile-pictures'

describe('profile picture fixtures', () => {
  test('lists pic####.jpg fixtures from the pictures directory root', () => {
    const files = listProfilePictureFiles()
    expect(files.length).toBeGreaterThan(0)
    expect(files.every(fileName => PROFILE_PICTURE_FILE_PATTERN.test(fileName))).toBe(true)
  })

  test('allocator returns valid fixture files from a shuffled pool', () => {
    const pickPicture = createRandomProfilePictureAllocator()
    const files = new Set<string>()

    for (let index = 0; index < 20; index += 1) {
      const fileName = pickPicture()
      expect(listProfilePictureFiles()).toContain(fileName)
      files.add(fileName)
    }

    expect(files.size).toBeGreaterThan(1)
  })
})
