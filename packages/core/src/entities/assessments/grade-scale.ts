import { requireNonBlank, requireNonNegativeNumber, roundTo2 } from '$lib/core/utils/validation'

export interface GradeScaleRange {
  letter: string // e.g. "A" or "Assez Bien"
  minScore: number
  maxScore: number
  gpaValue?: number | null
  interpretation?: string | null
  isPassing: boolean
}

export interface GradeScaleArgs {
  id: string
  schoolId: string
  name: string
  minScore: number
  maxScore: number
  ranges: readonly GradeScaleRange[]
  isDefault?: boolean
  createdAt?: Date
}

export class GradeScale {
  readonly id: string
  readonly schoolId: string
  readonly name: string
  readonly minScore: number
  readonly maxScore: number
  readonly ranges: readonly GradeScaleRange[]
  readonly isDefault: boolean
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    name,
    minScore,
    maxScore,
    ranges,
    isDefault = false,
    createdAt,
  }: GradeScaleArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.name = requireNonBlank(name, 'name')
    this.minScore = roundTo2(requireNonNegativeNumber(minScore, 'minScore'))
    this.maxScore = roundTo2(requireNonNegativeNumber(maxScore, 'maxScore'))
    this.ranges = Object.freeze([...ranges])
    this.isDefault = isDefault
    this.createdAt = createdAt ?? new Date()
  }

  findRange(score: number): GradeScaleRange | undefined {
    return this.ranges.find(r => score >= r.minScore && score <= r.maxScore)
  }
}
