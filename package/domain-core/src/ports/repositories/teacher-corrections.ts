import type { CorrectionWorkflow, TeacherCorrection } from '../../domain/corrections'
import type { ResourceAccessScope } from './resource-access-scope'

/** Command-owned lifecycle/history, never exposed through generic entity CRUD. */
export interface TeacherWorkflowState {
  schoolId: string
  workflow: CorrectionWorkflow
  targetId: string
  version: number
  locked: boolean
  payload: Record<string, unknown>
  history: Array<{ at: string, subjectId: string, action: string, payload: Record<string, unknown> }>
}
export interface TeacherCorrectionsPort {
  referencedLessonSessionIds: (schoolId: string, sessionIds: readonly string[]) => Promise<string[]>
  find: (schoolId: string, id: string) => Promise<TeacherCorrection | undefined>
  save: (row: TeacherCorrection) => Promise<void>
  forTarget: (schoolId: string, workflow: CorrectionWorkflow, targetId: string) => Promise<TeacherCorrection[]>
  list: (scope: ResourceAccessScope, input: { workflow: CorrectionWorkflow, status: TeacherCorrection['status'], offset: number, limit: number, classGroupId?: string, periodId?: string, teacherSubjectId?: string, studentId?: string, search?: string, from?: Date, to?: Date }) => Promise<{ items: TeacherCorrection[], total: number }>
  state: (schoolId: string, workflow: CorrectionWorkflow, targetId: string) => Promise<TeacherWorkflowState | undefined>
  saveState: (state: TeacherWorkflowState) => Promise<void>
}
