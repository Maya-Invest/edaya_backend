export type CountryCode = 'CI' | 'FR'

/** Legacy read-side identity; canonical writes validate IDs against dataset membership. */
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
  /** Per-level compatibility projection for older template-list clients. */
  reportCardStructure?: StructureTemplateReportCardStructure
}

export interface StructureTemplateSubject {
  categoryCode?: string
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

export interface StructureTemplateReportCardStructure {
  gradingScale: number
  periods: StructureTemplateReportCardPeriod[]
  passingGrade: number
  /** Legacy presentation metadata derived from canonical categories. */
  domainCategories?: StructureTemplateReportCardDomainCategory[]
  modules?: Array<{ name: string, order: number, subjectCodes: string[], weightingMode: 'subject_coefficients' | 'explicit', explicitWeight?: number }>
  includeSummary?: boolean
  includeComments?: boolean
  summaryPeriod?: StructureTemplateReportCardPeriod
}

export interface StructureTemplateDefinition {
  subjectCategories?: Array<{ code: string, name: string }>
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
