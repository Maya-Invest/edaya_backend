import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports'
import { z } from 'zod'
import { directPermissionEntityConfig, readByIds } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { parseDomain, zodDate } from '../shared/utils'

export const studentHealthProfileBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  allergies: z.string().trim().min(1, 'allergies must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  medicalConditions: z.string().trim().min(1, 'medicalConditions must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  medications: z.string().trim().min(1, 'medications must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  clinicalNotes: z.string().trim().min(1, 'clinicalNotes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  lastVisit: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  emergencyProtocols: z.string().trim().min(1, 'emergencyProtocols must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  bloodType: z.string().trim().min(1, 'bloodType must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().default(() => new Date()),
})

function refineStudentHealthProfile(data: any, ctx: z.RefinementCtx) {
  if (data.updatedAt.getTime() < data.createdAt.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'updatedAt must not be before createdAt',
    })
  }
}

export const studentHealthProfileSchema = studentHealthProfileBaseSchema.superRefine(refineStudentHealthProfile)

export type StudentHealthProfileData = z.infer<typeof studentHealthProfileSchema>
export type StudentHealthProfileInput = z.input<typeof studentHealthProfileSchema>

export const studentHealthProfileCreateSchema = studentHealthProfileBaseSchema.omit({ createdAt: true, updatedAt: true }).superRefine(refineStudentHealthProfile)
export const studentHealthProfileUpdateSchema = studentHealthProfileBaseSchema.partial().required({ id: true }).superRefine(refineStudentHealthProfile)

/**
 * Contains health and emergency information that requires access controls
 * independent from the general student directory profile.
 */
export class StudentHealthProfile {
  readonly data: StudentHealthProfileData

  constructor(args: StudentHealthProfileInput) {
    this.data = parseDomain(studentHealthProfileSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get studentId() { return this.data.studentId }
  get allergies() { return this.data.allergies }
  get medicalConditions() { return this.data.medicalConditions }
  get medications() { return this.data.medications }
  get clinicalNotes() { return this.data.clinicalNotes }
  get lastVisit() { return this.data.lastVisit }
  get emergencyProtocols() { return this.data.emergencyProtocols }
  get bloodType() { return this.data.bloodType }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
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
