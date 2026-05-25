import type { ReportCardDefinitionSection } from './report-card-definition-section'
import { requireNonBlank, requireOptionalNonBlank } from '../../utils/validation'

export enum ReportCardDefinitionKind {
  Default = 'default',
  Exam = 'exam',
  Custom = 'custom',
}

export interface ReportCardDefinitionArgs {
  id: string
  schoolId: string
  academicYearId: string
  gradeLevelId: string
  name: string
  kind?: ReportCardDefinitionKind
  isDefault?: boolean
  description?: string | null
  sections?: readonly ReportCardDefinitionSection[]
  createdAt?: Date
}

/**
 * Represents a reusable report-card template for a grade level.
 * Sections define the hierarchy, weights, and subject mappings used when
 * generating report-card results.
 */
export class ReportCardDefinition {
  readonly id: string
  readonly schoolId: string
  readonly academicYearId: string
  readonly gradeLevelId: string
  readonly name: string
  readonly kind: ReportCardDefinitionKind
  readonly isDefault: boolean
  readonly description?: string
  readonly sections: readonly ReportCardDefinitionSection[]
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    academicYearId,
    gradeLevelId,
    name,
    kind = ReportCardDefinitionKind.Custom,
    isDefault = false,
    description,
    sections,
    createdAt,
  }: ReportCardDefinitionArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.gradeLevelId = requireNonBlank(gradeLevelId, 'gradeLevelId')
    this.name = requireNonBlank(name, 'name')
    this.kind = kind
    this.isDefault = isDefault
    this.description = requireOptionalNonBlank(description, 'description')
    this.sections = Object.freeze(sections ? [...sections] : [])
    this.createdAt = createdAt ?? new Date()
  }
}
