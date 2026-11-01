export interface AutoBillingRun {
  id: string
  schoolId: string
  catalogServiceId: string
  academicYearId: string
  studentId?: string
  trigger: 'fee_saved' | 'enrollment_changed' | 'placement_status_changed' | 'class_grade_changed'
  triggeredById: string
  configurationRevision: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  workId: string
  cursor: string
  createdCount: number
  skippedCount: number
  failureCode?: string
  createdAt: string
  updatedAt: string
}

/** Writes participate in the caller's business transaction. */
export interface AutoBillingPort {
  save: (run: AutoBillingRun) => Promise<void>
  get: (schoolId: string, id: string) => Promise<AutoBillingRun | undefined>
  listForFee: (schoolId: string, catalogServiceId: string, limit?: number) => Promise<AutoBillingRun[]>
  /** Active placements, stable student ordering; always bounded and school/year scoped. */
  candidates: (schoolId: string, academicYearId: string, afterStudentId: string, limit: number) => Promise<string[]>
}
