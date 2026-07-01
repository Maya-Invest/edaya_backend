import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import { z } from 'zod'
import { anyPermissionAction, directPermissionEntityConfig, unique } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { parseDomain, zodDate } from '../shared/utils'

export const guardianStudentLinkSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  guardianId: z.string().trim().min(1, 'guardianId must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  relationship: z.string().trim().min(1, 'relationship must not be blank').default('parent'),
  isPrimary: z.boolean().default(false),
  isBillingContact: z.boolean().default(false),
  legalGuardian: z.boolean().default(false),
  canPickup: z.boolean().default(false),
  emergencyContactPriority: z.number().int().positive('emergencyContactPriority must be a strictly positive integer').nullable().optional().transform(v => v === null ? undefined : v),
  receivesAcademicReports: z.boolean().default(true),
  receivesAttendanceAlerts: z.boolean().default(true),
  contactRestrictions: z.string().trim().min(1, 'contactRestrictions must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notes: z.string().trim().min(1, 'notes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type GuardianStudentLinkData = z.infer<typeof guardianStudentLinkSchema>
export type GuardianStudentLinkInput = z.input<typeof guardianStudentLinkSchema>

export const guardianStudentLinkCreateSchema = guardianStudentLinkSchema.omit({ createdAt: true })
export const guardianStudentLinkUpdateSchema = guardianStudentLinkSchema.partial().required({ id: true })

/**
 * Defines a relationship between a guardian and a student.
 * Enables multiple guardians per student and multiple students per guardian.
 */
export class GuardianStudentLink {
  readonly data: GuardianStudentLinkData

  constructor(args: GuardianStudentLinkInput) {
    this.data = parseDomain(guardianStudentLinkSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get guardianId() { return this.data.guardianId }
  get studentId() { return this.data.studentId }
  get relationship() { return this.data.relationship }
  get isPrimary() { return this.data.isPrimary }
  get isBillingContact() { return this.data.isBillingContact }
  get legalGuardian() { return this.data.legalGuardian }
  get canPickup() { return this.data.canPickup }
  get emergencyContactPriority() { return this.data.emergencyContactPriority }
  get receivesAcademicReports() { return this.data.receivesAcademicReports }
  get receivesAttendanceAlerts() { return this.data.receivesAttendanceAlerts }
  get contactRestrictions() { return this.data.contactRestrictions }
  get notes() { return this.data.notes }
  get createdAt() { return this.data.createdAt }
}

export const guardianStudentLinkConfig: EntityConfigFactory<GuardianStudentLink> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.guardianLinks,
    Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ,
    Permission.PARENT_UPDATE,
    async (actor, entities) => {
      await input.policy.checkStudentAccess(actor, unique(entities.map(entity => entity.studentId)))
    },
  )
  config.read.checkModule = anyPermissionAction([
    Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ,
    Permission.QUERY_GUARDIAN_SELF_READ,
  ])
  return {
    ...config,
    gates: {
      preSave: validateGuardianStudentLinkSave,
    },
  }
}

export async function validateGuardianStudentLinkSave(
  link: GuardianStudentLink,
  existing: GuardianStudentLink | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [guardian, student] = await Promise.all([
    repositories.guardians.findById(link.guardianId),
    repositories.students.findById(link.studentId),
  ])
  if (!guardian || !student || guardian.schoolId !== link.schoolId || student.schoolId !== link.schoolId) {
    denyResourceAccess()
  }
  if (existing && (existing.guardianId !== link.guardianId || existing.studentId !== link.studentId)) {
    denyResourceAccess()
  }
}
