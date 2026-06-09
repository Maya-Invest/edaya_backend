import type { SchoolRepositories } from '../../ports'
import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { AttachmentOwnerKind } from '../../domains'
import { directPermissionEntityConfig, readByIds } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

export enum StudentStatus {
  Active = 'active',
  Inactive = 'inactive',
  Graduated = 'graduated',
  Archived = 'archived',
}

export interface StudentArgs {
  id: string
  schoolId: string
  firstName: string
  lastName: string
  gender?: string | null
  birthDate?: Date
  placeOfBirth?: string | null
  nationality?: string | null
  matricule?: string | null
  photoUrl?: string | null
  subjectId?: string | null
  status?: StudentStatus
  enrollmentDate?: Date | null
  createdAt?: Date
}

/**
 * Represents an individual student attending the school.
 * Holds fundamental biographical data.
 * Gender is a free-form string to allow school-specific customisation.
 */
export class Student {
  readonly id: string
  readonly schoolId: string
  readonly firstName: string
  readonly lastName: string
  readonly gender?: string
  readonly birthDate?: Date
  readonly placeOfBirth?: string
  readonly nationality?: string
  readonly matricule?: string
  readonly photoUrl?: string
  readonly subjectId?: string
  readonly status: StudentStatus
  readonly enrollmentDate?: Date
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    firstName,
    lastName,
    gender,
    birthDate,
    placeOfBirth,
    nationality,
    matricule,
    photoUrl,
    subjectId,
    status = StudentStatus.Active,
    enrollmentDate,
    createdAt,
  }: StudentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.firstName = requireNonBlank(firstName, 'firstName')
    this.lastName = requireNonBlank(lastName, 'lastName')
    this.gender = requireOptionalNonBlank(gender, 'gender')
    this.birthDate = birthDate
    this.placeOfBirth = requireOptionalNonBlank(placeOfBirth, 'placeOfBirth')
    this.nationality = requireOptionalNonBlank(nationality, 'nationality')
    this.matricule = requireOptionalNonBlank(matricule, 'matricule')
    this.photoUrl = requireOptionalNonBlank(photoUrl, 'photoUrl')
    this.subjectId = requireOptionalNonBlank(subjectId, 'subjectId')
    this.status = status
    this.enrollmentDate = enrollmentDate ? requireValidDate(enrollmentDate, 'enrollmentDate') : undefined
    this.createdAt = createdAt ?? new Date()
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`
  }

  copyWith(changes: Partial<StudentArgs>): Student {
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
