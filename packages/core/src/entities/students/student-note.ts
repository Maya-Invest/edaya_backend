import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../../utils/validation'

export enum StudentNoteVisibility {
  Staff = 'staff',
  AdminOnly = 'admin_only',
  GuardianVisible = 'guardian_visible',
}

export interface StudentNoteArgs {
  id: string
  schoolId: string
  studentId: string
  authorStaffId: string
  body: string
  title?: string | null
  visibility?: StudentNoteVisibility
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Internal note attached to a student profile, with explicit visibility.
 */
export class StudentNote {
  readonly id: string
  readonly schoolId: string
  readonly studentId: string
  readonly authorStaffId: string
  readonly title?: string
  readonly body: string
  readonly visibility: StudentNoteVisibility
  readonly createdAt: Date
  readonly updatedAt: Date

  constructor({
    id,
    schoolId,
    studentId,
    authorStaffId,
    title,
    body,
    visibility = StudentNoteVisibility.Staff,
    createdAt,
    updatedAt,
  }: StudentNoteArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.authorStaffId = requireNonBlank(authorStaffId, 'authorStaffId')
    this.title = requireOptionalNonBlank(title, 'title')
    this.body = requireNonBlank(body, 'body')
    this.visibility = visibility
    const now = new Date()
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : now
    this.updatedAt = updatedAt ? requireValidDate(updatedAt, 'updatedAt') : now

    if (this.updatedAt.getTime() < this.createdAt.getTime()) {
      throw new Error('updatedAt must not be before createdAt')
    }
  }
}
