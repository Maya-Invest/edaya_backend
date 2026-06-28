import { describe, expect, it } from 'bun:test'
import { countSeedGuardians, countSeedStudents, SEED_CLASS_STUDENT_IDS, SEED_STUDENTS } from './dataset'
import {
  countSeedBulkClasses,
  countSeedBulkGuardians,
  countSeedBulkStudents,
  SEED_BULK_GUARDIANS,
  SEED_TARGET_STUDENT_COUNT,
} from './population-generator'

describe('population generator', () => {
  it('generates 970 bulk students for a 1000-student dev dataset', () => {
    expect(SEED_TARGET_STUDENT_COUNT).toBe(1000)
    expect(countSeedBulkStudents()).toBe(970)
    expect(countSeedBulkGuardians()).toBe(970)
    expect(countSeedBulkClasses()).toBe(33)
    expect(countSeedStudents()).toBe(1000)
    expect(countSeedGuardians()).toBeGreaterThanOrEqual(990)
  })

  it('derives class distribution covering every student exactly once', () => {
    const groupedIds = Object.values(SEED_CLASS_STUDENT_IDS).flat()
    expect(groupedIds.length).toBe(SEED_STUDENTS.length)
    expect(new Set(groupedIds).size).toBe(SEED_STUDENTS.length)
  })

  it('uses realistic guardian email domains for bulk fixtures', () => {
    const sample = SEED_BULK_GUARDIANS.slice(0, 20)
    expect(sample.every(entry => !entry.email.includes('@seed.edaya.test'))).toBe(true)
    expect(sample.every(entry => /@[a-z0-9.-]+\.(?:com|ca)$/.test(entry.email))).toBe(true)
    expect(new Set(SEED_BULK_GUARDIANS.map(entry => entry.email)).size).toBe(SEED_BULK_GUARDIANS.length)
  })
})
