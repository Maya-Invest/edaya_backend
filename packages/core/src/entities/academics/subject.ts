import { requireNonBlank, requireOptionalNonBlank, requirePositiveNumber } from '../utils'

export interface SubjectArgs {
  id: string
  schoolId: string
  name: string
  code?: string | null
  defaultCoefficient?: number | null
  createdAt?: Date
}

/**
 * Represents a learning subject (e.g., Mathematics, History) in the global school catalog.
 * Subjects are linked to classGroups and assigned staff through ClassSubject.
 */
export class Subject {
  readonly id: string
  readonly schoolId: string
  readonly name: string
  readonly code?: string
  readonly defaultCoefficient?: number
  readonly createdAt: Date

  constructor({ id, schoolId, name, code, defaultCoefficient, createdAt }: SubjectArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.name = requireNonBlank(name, 'name')
    this.code = requireOptionalNonBlank(code, 'code')
    if (defaultCoefficient != null) {
      this.defaultCoefficient = requirePositiveNumber(defaultCoefficient, 'defaultCoefficient')
    }
    this.createdAt = createdAt ?? new Date()
  }

  copyWith({ name, code, defaultCoefficient }: { name?: string, code?: string, defaultCoefficient?: number }): Subject {
    return new Subject({
      id: this.id,
      schoolId: this.schoolId,
      name: name ?? this.name,
      code: code !== undefined ? code : this.code,
      defaultCoefficient: defaultCoefficient !== undefined ? defaultCoefficient : this.defaultCoefficient,
      createdAt: this.createdAt,
    })
  }
}
