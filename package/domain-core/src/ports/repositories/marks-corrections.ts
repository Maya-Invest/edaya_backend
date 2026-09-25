import type { MarksCorrection } from '../../domain/assessments/marks-review'
import type { ResourceAccessScope } from './resource-access-scope'

export interface MarksCorrectionsPort {
  find: (schoolId: string, id: string) => Promise<MarksCorrection | undefined>
  save: (correction: MarksCorrection) => Promise<void>
  forAssessment: (schoolId: string, assessmentId: string) => Promise<MarksCorrection[]>
  pendingForMarks: (schoolId: string, resultIds: readonly string[]) => Promise<string[]>
  list: (scope: ResourceAccessScope, input: { status?: MarksCorrection['status'], classGroupId?: string, periodId?: string, offset: number, limit: number }) => Promise<{ items: MarksCorrection[], total: number }>
}
