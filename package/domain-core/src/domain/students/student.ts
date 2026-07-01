import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports'
import { z } from 'zod'
import { anyPermissionAction, directPermissionEntityConfig, readByIds } from '../../application/entities/entity-config'
import { Permission } from '../../capabilities/authorization'
import { AttachmentOwnerKind } from '../../domain'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { parseDomain, zodDate } from '../shared/utils'

export enum StudentStatus {
  Active = 'active',
  Inactive = 'inactive',
  Graduated = 'graduated',
  Archived = 'archived',
}

export const studentSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  firstName: z.string().trim().min(1, 'firstName must not be blank'),
  lastName: z.string().trim().min(1, 'lastName must not be blank'),
  gender: z.string().trim().min(1, 'gender must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  birthDate: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  placeOfBirth: z.string().trim().min(1, 'placeOfBirth must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  nationality: z.string().trim().min(1, 'nationality must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  matricule: z.string().trim().min(1, 'matricule must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  photoUrl: z.string().trim().min(1, 'photoUrl must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  status: z.nativeEnum(StudentStatus).default(StudentStatus.Active),
  enrollmentDate: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type StudentData = z.infer<typeof studentSchema>
export type StudentInput = z.input<typeof studentSchema>

export const studentCreateSchema = studentSchema.omit({ createdAt: true })
export const studentUpdateSchema = studentSchema.partial().required({ id: true })

/**
 * Represents an individual student attending the school.
 * Holds fundamental biographical data.
 * Gender is a free-form string to allow school-specific customisation.
 */
export class Student {
  readonly data: StudentData

  constructor(args: StudentInput) {
    this.data = parseDomain(studentSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get firstName() { return this.data.firstName }
  get lastName() { return this.data.lastName }
  get gender() { return this.data.gender }
  get birthDate() { return this.data.birthDate }
  get placeOfBirth() { return this.data.placeOfBirth }
  get nationality() { return this.data.nationality }
  get matricule() { return this.data.matricule }
  get photoUrl() { return this.data.photoUrl }
  get subjectId() { return this.data.subjectId }
  get status() { return this.data.status }
  get enrollmentDate() { return this.data.enrollmentDate }
  get createdAt() { return this.data.createdAt }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`
  }

  copyWith(changes: Partial<StudentInput>): Student {
    return new Student({
      id: this.id,
      schoolId: this.schoolId,
      firstName: this.firstName,
      lastName: this.lastName,
      gender: this.gender,
      birthDate: this.birthDate,
      placeOfBirth: this.placeOfBirth,
      nationality: this.nationality,
      matricule: this.matricule,
      photoUrl: this.photoUrl,
      subjectId: this.subjectId,
      status: this.status,
      enrollmentDate: this.enrollmentDate,
      createdAt: this.createdAt,
      ...changes,
    })
  }
}

export const studentConfig: EntityConfigFactory<Student> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.students,
    Permission.QUERY_STUDENT_DIRECTORY_READ,
    Permission.STUDENT_UPDATE,
    readByIds((actor, ids) => input.policy.checkStudentAccess(actor, ids)),
  )
  config.read.checkModule = anyPermissionAction([
    Permission.QUERY_STUDENT_DIRECTORY_READ,
    Permission.QUERY_STUDENT_DETAIL_READ,
  ])
  return {
    ...config,
    gates: {
      preSave: validateStudentSave,
      preDelete: validateStudentDelete,
    },
  }
}

export async function validateStudentSave(
  student: Student,
  existing: Student | undefined,
): Promise<void> {
  if (existing?.status === StudentStatus.Graduated && student.status !== StudentStatus.Graduated) {
    throw new BusinessRuleViolationError('GRADUATED_STUDENT_STATUS_RESTRICTED', `Student ${student.id} cannot leave graduated status through profile update`)
  }
}

async function validateStudentDelete(
  student: Student,
  repositories: SchoolRepositories,
): Promise<void> {
  const [
    enrollments,
    guardianLinks,
    notes,
    healthProfiles,
    studentFees,
    attendance,
    assessmentResults,
    reportCards,
    incidentInvolvements,
    disciplinaryActions,
    attachments,
  ] = await Promise.all([
    repositories.enrollments.list({ studentId: student.id }),
    repositories.guardianLinks.list({ studentId: student.id }),
    repositories.studentNotes.list({ studentId: student.id }),
    repositories.studentHealthProfiles.list({ studentId: student.id }),
    repositories.studentFees.list({ studentId: student.id }),
    repositories.attendance.list({ studentId: student.id }),
    repositories.assessmentResults.list({ studentId: student.id }),
    repositories.results.list({ studentId: student.id }),
    repositories.studentIncidentInvolvements.list({ studentId: student.id }),
    repositories.studentDisciplinaryActions.list({ studentId: student.id }),
    repositories.attachments.list({ ownerKind: AttachmentOwnerKind.Student, ownerId: student.id }),
  ])
  if (
    enrollments.length > 0
    || guardianLinks.length > 0
    || notes.length > 0
    || healthProfiles.length > 0
    || studentFees.length > 0
    || attendance.length > 0
    || assessmentResults.length > 0
    || reportCards.length > 0
    || incidentInvolvements.length > 0
    || disciplinaryActions.length > 0
    || attachments.length > 0
  ) {
    throw new BusinessRuleViolationError('STUDENT_HAS_DEPENDENCIES', `Cannot delete student ${student.id}: dependent records still exist`)
  }
}
