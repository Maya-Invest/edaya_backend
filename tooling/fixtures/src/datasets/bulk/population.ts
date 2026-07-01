import type {
  ClassGroupInput,
  GuardianInput,
  GuardianStudentLinkInput,
  StudentClassEnrollmentInput,
  StudentInput,
} from '@edaya/core'
import { generateBulkPopulation } from './generator'

const generated = generateBulkPopulation()

export const bulkClassGroups = generated.classGroups satisfies readonly ClassGroupInput[]
export const bulkStudents = generated.students satisfies readonly StudentInput[]
export const bulkGuardians = generated.guardians satisfies readonly GuardianInput[]
export const bulkEnrollments = generated.enrollments satisfies readonly StudentClassEnrollmentInput[]
export const bulkGuardianLinks = generated.guardianLinks satisfies readonly GuardianStudentLinkInput[]

export const bulkPopulationSlice = {
  classGroups: bulkClassGroups,
  students: bulkStudents,
  guardians: bulkGuardians,
  enrollments: bulkEnrollments,
  guardianLinks: bulkGuardianLinks,
} as const
