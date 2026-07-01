export type CountryCode = 'CI' | 'FR'

export type StructureTemplateId
  = | 'ci-primaire'
    | 'ci-college'
    | 'ci-lycee'

export interface StructureTemplateGradeLevel {
  /** Globally unique id: `{templateId}:{levelCode}` */
  id: string
  code: string
  name: string
  shortLabel: string
  order: number
  examYear?: boolean
  examName?: string
}

export interface StructureTemplateSubject {
  code: string
  shortName: string
  domain: string
  defaultCoefficient: number
}

export interface StructureTemplateCurriculumEntry {
  levelCodes: string[]
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

export interface StructureTemplateReportCardStructure {
  gradingScale: number
  periods: StructureTemplateReportCardPeriod[]
  passingGrade: number
  domainCategories: StructureTemplateReportCardDomainCategory[]
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
