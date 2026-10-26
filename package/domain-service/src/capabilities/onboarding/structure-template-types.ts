export type CountryCode = 'CI' | 'FR'

/** Builtin CI ids look like `ci-college`; any `ci-*` string is accepted at runtime. */
export type StructureTemplateId = string

export interface StructureTemplateGradeLevel {
  /** Globally unique id: `{templateId}:{levelCode}` */
  id: string
  code: string
  name: string
  shortLabel: string
  order: number
  examYear?: boolean
  examName?: string
  /** Per-level bulletin layout — preferred over template.reportCardStructure.sections. */
  reportCardStructure?: StructureTemplateReportCardStructure
}

export interface StructureTemplateSubject {
  code: string
  shortName: string
  domain: string
  defaultCoefficient: number
}

export interface StructureTemplateCurriculumEntry {
  /** Single grade level — no multi-level sharing. */
  levelCode: string
  subjectCode: string
  longName?: string
  coefficient: number
  matters: string[]
  isOptional?: boolean
}

export interface StructureTemplateReportCardPeriod {
  code: string
  name: string
  weight: number
}

export interface StructureTemplateReportCardDomainCategory {
  domain: string
  label: string
  order: number
  coefficient?: number
  weight?: number
}

export type StructureTemplateReportCardSectionRole = 'subjects' | 'summary' | 'comments'

export interface StructureTemplateReportCardSection {
  role: StructureTemplateReportCardSectionRole
  label: string
  order: number
  subjectCodes?: string[]
}

export interface StructureTemplateReportCardStructure {
  gradingScale: number
  periods: StructureTemplateReportCardPeriod[]
  passingGrade: number
  /** Optional catalog metadata; bulletin layout prefers `sections` when present. */
  domainCategories?: StructureTemplateReportCardDomainCategory[]
  modules?: Array<{ name: string, order: number, subjectCodes: string[], weightingMode: 'subject_coefficients' | 'explicit', explicitWeight?: number }>
  includeSummary?: boolean
  includeComments?: boolean
  summaryPeriod?: StructureTemplateReportCardPeriod
}

export interface StructureTemplateDefinition {
  id: StructureTemplateId
  countryCode: CountryCode
  label: string
  description: string
  cycle: string
  reportCardStructure?: StructureTemplateReportCardStructure
  gradeLevels: StructureTemplateGradeLevel[]
  subjects: StructureTemplateSubject[]
  curriculum: StructureTemplateCurriculumEntry[]
}
