import { requireNonBlank, requireOptionalNonBlank, requirePositiveNumber } from '../../utils/validation'

export interface ClassSubjectArgs {
  id: string
  classroomId: string
  subjectId: string
  staffId?: string | null
  moduleId?: string | null
  coefficient?: number | null
  createdAt?: Date
}

export class ClassSubject {
  readonly id: string
  readonly classroomId: string
  readonly subjectId: string
  readonly staffId?: string
  readonly moduleId?: string
  readonly coefficient?: number
  readonly createdAt: Date

  constructor({
    id,
    classroomId,
    subjectId,
    staffId,
    moduleId,
    coefficient,
    createdAt,
  }: ClassSubjectArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classroomId = requireNonBlank(classroomId, 'classroomId')
    this.subjectId = requireNonBlank(subjectId, 'subjectId')
    this.staffId = requireOptionalNonBlank(staffId, 'staffId')
    this.moduleId = requireOptionalNonBlank(moduleId, 'moduleId')
    if (coefficient != null) {
      this.coefficient = requirePositiveNumber(coefficient, 'coefficient')
    }
    this.createdAt = createdAt ?? new Date()
  }
}
