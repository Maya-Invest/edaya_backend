import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '$lib/core/utils/validation'

export interface DeadlineArgs {
  id: string
  schoolId: string
  title: string
  dueAt: Date
  classroomId?: string | null
  moduleId?: string | null
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
  readonly classroomId?: string
  readonly moduleId?: string
  readonly metAt?: Date
  readonly createdAt: Date

  constructor({ id, schoolId, title, dueAt, classroomId, moduleId, metAt, createdAt }: DeadlineArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.title = requireNonBlank(title, 'title')
    this.dueAt = requireValidDate(dueAt, 'dueAt')
    this.classroomId = requireOptionalNonBlank(classroomId, 'classroomId')
    this.moduleId = requireOptionalNonBlank(moduleId, 'moduleId')
    this.metAt = metAt ? requireValidDate(metAt, 'metAt') : undefined
    this.createdAt = createdAt ?? new Date()
  }

  get isMet(): boolean {
    return this.metAt != null
  }
}
