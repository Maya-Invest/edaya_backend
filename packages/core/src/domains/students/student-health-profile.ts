import type { SchoolRepositories } from '../../ports'
import type { EntityConfigFactory } from '../../shared'
import { denyResourceAccess, Permission } from '../../authorization'
import { directPermissionEntityConfig, readByIds } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

export interface StudentHealthProfileArgs {
  id: string
  schoolId: string
  studentId: string
  allergies?: string | null
  medicalConditions?: string | null
  emergencyProtocols?: string | null
  bloodType?: string | null
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Contains health and emergency information that requires access controls
 * independent from the general student directory profile.
 */
export class StudentHealthProfile {
  readonly id: string
  readonly schoolId: string
  readonly studentId: string
  readonly allergies?: string
  readonly medicalConditions?: string
  readonly emergencyProtocols?: string
  readonly bloodType?: string
  readonly createdAt: Date
  readonly updatedAt: Date

  constructor({
    id,
    schoolId,
    studentId,
    allergies,
    medicalConditions,
    emergencyProtocols,
    bloodType,
    createdAt,
    updatedAt,
  }: StudentHealthProfileArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.allergies = requireOptionalNonBlank(allergies, 'allergies')
    this.medicalConditions = requireOptionalNonBlank(medicalConditions, 'medicalConditions')
    this.emergencyProtocols = requireOptionalNonBlank(emergencyProtocols, 'emergencyProtocols')
    this.bloodType = requireOptionalNonBlank(bloodType, 'bloodType')
    const now = new Date()
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : now
    this.updatedAt = updatedAt ? requireValidDate(updatedAt, 'updatedAt') : now
    if (this.updatedAt.getTime() < this.createdAt.getTime()) {
      throw new Error('updatedAt must not be before createdAt')
    }
  }
}

export const studentHealthProfileConfig: EntityConfigFactory<StudentHealthProfile> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.studentHealthProfiles,
    Permission.STUDENT_HEALTH_READ,
    Permission.STUDENT_HEALTH_UPDATE,
    readByIds((actor, ids) => input.policy.checkStudentHealthAccess(actor, ids)),
  )
  return {
    ...config,
    gates: {
      preSave: validateStudentHealthProfileSave,
    },
  }
}

async function validateStudentHealthProfileSave(
  profile: StudentHealthProfile,
  existing: StudentHealthProfile | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const student = await repositories.students.findById(profile.studentId)
  if (!student || student.schoolId !== profile.schoolId) {
    denyResourceAccess()
  }
  if (existing && (existing.schoolId !== profile.schoolId || existing.studentId !== profile.studentId)) {
    denyResourceAccess()
  }
  const profiles = await repositories.studentHealthProfiles.list({
    schoolId: profile.schoolId,
    studentId: profile.studentId,
  })
  const duplicate = profiles.find(item => item.id !== profile.id)
  if (duplicate) {
    throw new BusinessRuleViolationError('STUDENT_HEALTH_PROFILE_ALREADY_EXISTS', `Student ${profile.studentId} already has a health profile`)
  }
}
