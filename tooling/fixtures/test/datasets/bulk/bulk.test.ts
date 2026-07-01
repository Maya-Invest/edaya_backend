import type { StudentInput } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import { bulkDataset } from '../../../src/datasets/bulk'
import { BULK_TARGET_STUDENT_COUNT } from '../../../src/datasets/bulk/constants'
import {
  bulkClassGroups,
  bulkGuardians,
  bulkStudents,
} from '../../../src/datasets/bulk/population'
import {
  buildClassStudentIds,
  countGuardians,
  countStudents,
} from '../../../src/meta/fixture-counts'

describe('bulk population dataset', () => {
  it('typed students satisfy StudentInput', () => {
    const student = bulkStudents[0] satisfies StudentInput
    expect(student.id).toBe('s31')
    expect(student.schoolId).toBe('sch-edaya-central')
  })

  it('generates 970 bulk students for a 1000-student dev dataset', () => {
    expect(BULK_TARGET_STUDENT_COUNT).toBe(1000)
    expect(bulkStudents.length).toBe(970)
    expect(bulkGuardians.length).toBe(970)
    expect(bulkClassGroups.length).toBe(33)
    expect(countStudents(bulkDataset)).toBe(1000)
    expect(countGuardians(bulkDataset)).toBeGreaterThanOrEqual(990)
  })

  it('derives class distribution covering every student exactly once', () => {
    const classStudentIds = buildClassStudentIds(bulkDataset)
    const groupedIds = Object.values(classStudentIds).flat()
    expect(groupedIds.length).toBe(countStudents(bulkDataset))
    expect(new Set(groupedIds).size).toBe(countStudents(bulkDataset))
  })

  it('uses realistic guardian email domains for bulk fixtures', () => {
    const sample = bulkGuardians.slice(0, 20)
    expect(sample.every(entry => !entry.email?.includes('@seed.edaya.test'))).toBe(true)
    expect(sample.every(entry => /@[a-z0-9.-]+\.(?:com|ca)$/.test(entry.email ?? ''))).toBe(true)
    expect(new Set(bulkGuardians.map(entry => entry.email)).size).toBe(bulkGuardians.length)
  })
})
