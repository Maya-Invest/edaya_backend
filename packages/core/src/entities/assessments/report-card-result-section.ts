import { ReportCardDefinitionSectionKind } from '$lib/core/entities/assessments/report-card-definition-section'
import { requireNonBlank, requireNonNegativeNumber, roundTo2 } from '$lib/core/utils/validation'

export interface ReportCardResultSectionArgs {
  sectionId: string
  sectionKind: ReportCardDefinitionSectionKind
  name: string
  average: number
  weight: number
  parentSectionId?: string
  classSubjectId?: string
  subResults?: ReportCardResultSection[]
}

/**
 * Represents the computed result for one report-card section.
 * Group sections derive their average from child results; subject sections derive it from grades.
 */
export class ReportCardResultSection {
  readonly sectionId: string
  readonly sectionKind: ReportCardDefinitionSectionKind
  readonly name: string
  readonly average: number
  readonly weight: number
  readonly parentSectionId?: string
  readonly classSubjectId?: string
  readonly subResults: readonly ReportCardResultSection[]

  constructor({
    sectionId,
    sectionKind,
    name,
    average,
    weight,
    parentSectionId,
    classSubjectId,
    subResults,
  }: ReportCardResultSectionArgs) {
    this.sectionId = requireNonBlank(sectionId, 'sectionId')
    this.sectionKind = sectionKind
    this.name = requireNonBlank(name, 'name')
    this.average = roundTo2(requireNonNegativeNumber(average, 'average'))
    this.weight = requireNonNegativeNumber(weight, 'weight')
    this.parentSectionId = parentSectionId
    this.classSubjectId = classSubjectId
    this.subResults = Object.freeze(subResults ? [...subResults] : [])

    if (this.sectionKind === ReportCardDefinitionSectionKind.Group && this.classSubjectId) {
      throw new Error('group section results must not reference a class subject')
    }
    if (this.sectionKind === ReportCardDefinitionSectionKind.Subject && !this.classSubjectId) {
      throw new Error('subject section results must reference a class subject')
    }
  }
}
