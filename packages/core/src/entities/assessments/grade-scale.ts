import { requireNonBlank, requireNonNegativeNumber, requireOptionalNonBlank, roundTo2 } from '$lib/core/utils/validation'

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
    if (this.minScore > this.maxScore) {
      throw new Error('minScore must not exceed maxScore')
    }
    if (ranges.length === 0) {
      throw new Error('ranges must contain at least one range')
    }

    const validatedRanges: GradeScaleRange[] = []
    for (const [index, range] of ranges.entries()) {
      const validatedRange = {
        letter: requireNonBlank(range.letter, `ranges[${index}].letter`),
        minScore: roundTo2(requireNonNegativeNumber(range.minScore, `ranges[${index}].minScore`)),
        maxScore: roundTo2(requireNonNegativeNumber(range.maxScore, `ranges[${index}].maxScore`)),
        gpaValue: range.gpaValue == null
          ? undefined
          : roundTo2(requireNonNegativeNumber(range.gpaValue, `ranges[${index}].gpaValue`)),
        interpretation: requireOptionalNonBlank(range.interpretation, `ranges[${index}].interpretation`),
        isPassing: range.isPassing,
      }
      if (validatedRange.minScore > validatedRange.maxScore) {
        throw new Error(`ranges[${index}].minScore must not exceed its maxScore`)
      }
      if (validatedRange.minScore < this.minScore || validatedRange.maxScore > this.maxScore) {
        throw new Error(`ranges[${index}] must fall within the grade scale bounds`)
      }
      if (index > 0) {
        const previousRange = validatedRanges[index - 1]
        if (previousRange && validatedRange.minScore <= previousRange.maxScore) {
          throw new Error('ranges must be ordered by score and must not overlap')
        }
      }
      validatedRanges.push(Object.freeze(validatedRange))
    }

    this.ranges = Object.freeze(validatedRanges)
    this.isDefault = isDefault
    this.createdAt = createdAt ?? new Date()
  }

  findRange(score: number): GradeScaleRange | undefined {
    return this.ranges.find(r => score >= r.minScore && score <= r.maxScore)
  }
}
