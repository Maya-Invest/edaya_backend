import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { config, directSchoolTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireSchool } from '../../shared/require-school'
import { requireNonBlank, requireNonNegativeNumber, requireOptionalNonBlank, roundTo2 } from '../utils'

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

export const gradeScaleConfig: EntityConfigFactory<GradeScale> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.gradeScales,
    tenant: directSchoolTenant(),
    read: read(permissionAction(policy, Permission.GRADE_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.EXAM_CONFIG_CONFIGURE), noopSaveAccess, noopDeleteAccess),
    gates: {
      preSave: validateGradeScaleSave,
    },
    atomicExecution,
  })

async function validateGradeScaleSave(
  gradeScale: GradeScale,
  _existing: GradeScale | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await requireSchool(repositories.schools, gradeScale.schoolId)
  if (!gradeScale.isDefault)
    return

  const existingDefault = await repositories.gradeScales.findOne({
    schoolId: gradeScale.schoolId,
    isDefault: true,
  })
  if (existingDefault && existingDefault.id !== gradeScale.id) {
    throw new BusinessRuleViolationError(
      'DEFAULT_GRADE_SCALE_ALREADY_EXISTS',
      `School ${gradeScale.schoolId} already has a default grade scale`,
    )
  }
}
