import type { ReportCardDefinitionKind, ReportCardDefinitionSectionKind, ReportCardDefinitionSectionRole, ReportCardDefinitionStatus } from '@edaya/core'

export interface GradeScaleRangeSeedRecord {
  letter: string
  minScore: number
  maxScore: number
  interpretation?: string
  isPassing: boolean
}

export interface GradeScaleSeedRecord {
  id: string
  schoolId: string
  name: string
  minScore: number
  maxScore: number
  decimalPlaces: number
  description?: string
  isDefault: boolean
  ranges: readonly GradeScaleRangeSeedRecord[]
}

export interface ReportCardDefinitionSeedRecord {
  id: string
  schoolId: string
  academicYearId: string
  gradeLevelId: string
  gradeScaleId: string
  name: string
  kind: ReportCardDefinitionKind
  status: ReportCardDefinitionStatus
  isDefault: boolean
  description?: string
}

export interface ReportCardSectionSeedRecord {
  id: string
  reportCardDefinitionId: string
  name: string
  kind: ReportCardDefinitionSectionKind
  role?: ReportCardDefinitionSectionRole
  coefficient?: number
  order: number
  weight: number
  parentSectionId?: string
  subjectId?: string
}

export interface ReportCardResultSeedRecord {
  id: string
  studentId: string
  periodId: string
  reportCardDefinitionId: string
  generatedAt?: string
  publishedAt?: string
  overallAverage?: number
  rank?: number
  classSize?: number
  sectionMarks?: Record<string, readonly {
    subjectId: string
    average: number
    coefficient?: number
    appreciation?: string
  }[]>
}

export interface ReportCardTeacherCommentSeedRecord {
  id: string
  teacherComment: string
}

export interface ReportCardsSeedPort {
  createGradeScale: (record: GradeScaleSeedRecord) => Promise<void>
  createReportCardDefinition: (record: ReportCardDefinitionSeedRecord) => Promise<void>
  createReportCardSection: (record: ReportCardSectionSeedRecord) => Promise<void>
  generateReportCardResult: (record: ReportCardResultSeedRecord) => Promise<void>
  saveReportCardTeacherComment: (record: ReportCardTeacherCommentSeedRecord) => Promise<void>
  publishReportCardResult: (record: ReportCardResultSeedRecord) => Promise<void>
}
