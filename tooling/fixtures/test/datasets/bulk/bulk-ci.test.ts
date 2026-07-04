import type { StudentInput } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import { BULK_TARGET_STUDENT_COUNT } from '../../../src/datasets/bulk/constants'
import { generateBulkPopulation } from '../../../src/datasets/bulk/generator'
import { bulkCiDataset } from '../../../src/datasets/bulk/index-ci'
import { CI_LAST_NAMES } from '../../../src/datasets/bulk/name-pools'
import {
  bulkCiClassGroups,
  bulkCiGuardians,
  bulkCiStudents,
} from '../../../src/datasets/bulk/population-ci'
import {
  buildClassStudentIds,
  countGuardians,
  countStudents,
} from '../../../src/meta/fixture-counts'

describe('bulk CI population dataset', () => {
  it('typed students satisfy StudentInput', () => {
    const student = bulkCiStudents[0] satisfies StudentInput
    expect(student.id).toBe('s31')
    expect(student.schoolId).toBe('sch-edaya-central')
  })

  it('generates 970 bulk students for a 1000-student dev dataset', () => {
    expect(BULK_TARGET_STUDENT_COUNT).toBe(1000)
    expect(bulkCiStudents.length).toBe(970)
    expect(bulkCiGuardians.length).toBe(970)
    expect(bulkCiClassGroups.length).toBe(33)
    expect(countStudents(bulkCiDataset)).toBe(1000)
    expect(countGuardians(bulkCiDataset)).toBeGreaterThanOrEqual(990)
  })

  it('uses Ivorian names and French class labels', () => {
    const sampleStudent = bulkCiStudents[0]!
    expect(CI_LAST_NAMES).toContain(sampleStudent.lastName)

    const sampleClass = bulkCiClassGroups[0]!
    expect(sampleClass.name).toMatch(/6ème — Groupe/)
  })

  it('uses Ivorian phone prefixes and mail.ci domains for bulk guardians', () => {
    const sample = bulkCiGuardians.slice(0, 20)
    expect(sample.every(entry => entry.phone?.startsWith('+225'))).toBe(true)
    expect(sample.some(entry => entry.email?.endsWith('@mail.ci'))).toBe(true)
  })

  it('derives class distribution covering every student exactly once', () => {
    const classStudentIds = buildClassStudentIds(bulkCiDataset)
    const groupedIds = Object.values(classStudentIds).flat()
    expect(groupedIds.length).toBe(countStudents(bulkCiDataset))
    expect(new Set(groupedIds).size).toBe(countStudents(bulkCiDataset))
  })

  it('uses a distinct seed from the central bulk generator', () => {
    const central = generateBulkPopulation({ locale: 'central' })
    const ci = generateBulkPopulation({ locale: 'ci', seed: 20260702 })
    expect(central.students[0]?.firstName).not.toBe(ci.students[0]?.firstName)
  })
})
