import type { ClassGroupInput, GuardianInput, GuardianStudentLinkInput, StudentClassEnrollmentInput, StudentInput } from '@edaya/core'
import { generateBulkPopulation } from './generator'

const generated = generateBulkPopulation({ locale: 'ci', seed: 20260702 })

export const bulkCiClassGroups = generated.classGroups satisfies readonly ClassGroupInput[]
export const bulkCiStudents = generated.students satisfies readonly StudentInput[]
export const bulkCiGuardians = generated.guardians satisfies readonly GuardianInput[]
export const bulkCiEnrollments = generated.enrollments satisfies readonly StudentClassEnrollmentInput[]
export const bulkCiGuardianLinks = generated.guardianLinks satisfies readonly GuardianStudentLinkInput[]

export const bulkCiPopulationSlice = {
  classGroups: bulkCiClassGroups,
  students: bulkCiStudents,
  guardians: bulkCiGuardians,
  enrollments: bulkCiEnrollments,
  guardianLinks: bulkCiGuardianLinks,
} as const
