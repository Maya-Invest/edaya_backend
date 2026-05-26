import { requireNonBlank, requireOptionalNonBlank, requirePositiveNumber } from '../utils'

export interface SubjectMatterArgs {
  id: string
  subjectId: string
  name: string
  description?: string | null
  sequenceOrder: number
  estimatedHours?: number | null
  createdAt?: Date
}

export class SubjectMatter {
  readonly id: string
  readonly subjectId: string
  readonly name: string
  readonly description?: string
  readonly sequenceOrder: number
  readonly estimatedHours?: number
  readonly createdAt: Date

  constructor({ id, subjectId, name, description, sequenceOrder, estimatedHours, createdAt }: SubjectMatterArgs) {
    this.id = requireNonBlank(id, 'id')
    this.subjectId = requireNonBlank(subjectId, 'subjectId')
    this.name = requireNonBlank(name, 'name')
    this.description = requireOptionalNonBlank(description, 'description')
    this.sequenceOrder = requirePositiveNumber(sequenceOrder, 'sequenceOrder')
    if (estimatedHours != null) {
      this.estimatedHours = requirePositiveNumber(estimatedHours, 'estimatedHours')
    }
    this.createdAt = createdAt ?? new Date()
  }
}
