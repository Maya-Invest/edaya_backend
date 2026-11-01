export interface GradeScaleRangeSeedRecord {
  id: string
  gpaValue?: number
  letter: string
  minScore: number
  maxScore: number
  interpretation?: string

}

export interface GradeScaleSeedRecord {
  id: string
  schoolId: string
  name: string
  minScore: number
  maxScore: number
  decimalPlaces: number
  intervalConvention: 'continuous'
  roundingMode: 'nearest' | 'truncate'
  description?: string
  isDefault: boolean
  ranges: readonly GradeScaleRangeSeedRecord[]
}

export interface ReportConfigurationSeedRecord {
  gradeLevelId: string
  academicYearId: string
  passThreshold?: number
  modules: readonly { id: string, name: string, order: number, weightingMode: 'subject_coefficients' | 'explicit', explicitWeight?: number, subjectIds: readonly string[] }[]
}

export interface ReportCardResultSeedRecord {
  id: string
  studentId: string
  periodId: string
  generatedAt?: string
  publishedAt?: string
}

export interface ReportCardTeacherCommentSeedRecord {
  id: string
  teacherComment: string
}

export interface GradingPolicySeedRecord {
  gradeLevelId: string
  academicYearId: string
  scaleId: string
  mode: 'numeric-first'
  aggregateLabel: string
}

export interface ReportCardsSeedPort {
  createGradeScale: (record: GradeScaleSeedRecord) => Promise<void>
  /** Returns only after the level/year policy has finished recalculating. */
  configureGrading: (record: GradingPolicySeedRecord) => Promise<void>
  configureReport: (record: ReportConfigurationSeedRecord) => Promise<void>
  generateReportCardResult: (record: ReportCardResultSeedRecord) => Promise<void>
  saveReportCardTeacherComment: (record: ReportCardTeacherCommentSeedRecord) => Promise<void>
  publishReportCardResult: (record: ReportCardResultSeedRecord) => Promise<void>
}
