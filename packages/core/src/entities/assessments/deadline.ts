import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '$lib/core/utils/validation'

export interface DeadlineArgs {
  id: string
  schoolId: string
  title: string
  dueAt: Date
  classGroupId?: string | null
  classSubjectId?: string | null
  metAt?: Date
  createdAt?: Date
}

/**
 * Represents a point-in-time obligation such as an assignment deadline or administrative due date.
 */
export class Deadline {
  readonly id: string
  readonly schoolId: string
  readonly title: string
  readonly dueAt: Date
  readonly classGroupId?: string
  readonly classSubjectId?: string
  readonly metAt?: Date
  readonly createdAt: Date

  constructor({ id, schoolId, title, dueAt, classGroupId, classSubjectId, metAt, createdAt }: DeadlineArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.title = requireNonBlank(title, 'title')
    this.dueAt = requireValidDate(dueAt, 'dueAt')
    this.classGroupId = requireOptionalNonBlank(classGroupId, 'classGroupId')
    this.classSubjectId = requireOptionalNonBlank(classSubjectId, 'classSubjectId')
    this.metAt = metAt ? requireValidDate(metAt, 'metAt') : undefined
    this.createdAt = createdAt ?? new Date()
  }

  get isMet(): boolean {
    return this.metAt != null
  }
}
