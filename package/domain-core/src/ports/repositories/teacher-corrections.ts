import type { CorrectionProposal, CorrectionWorkflow, TeacherCorrection } from '../../domain/corrections'
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
export interface ActiveReportComment {
  proposal: Extract<CorrectionProposal, { workflow: 'report_comments' }>
  status: 'pending' | 'approved_pending_publication'
}

export interface TeacherCorrectionsPort {
  visibleReportSnapshots: (schoolId: string, reportIds: readonly string[]) => Promise<Array<{ reportId: string, snapshot: unknown }>>
  activeReportComments: (schoolId: string, classGroupId: string, authorSubjectId: string, reportIds: readonly string[]) => Promise<ActiveReportComment[]>
  dailyAttendanceSubmitted: (schoolId: string, workflowKey: string, attendanceId: string) => Promise<boolean>
  attendanceLessonStates: (schoolId: string, lessonIds: readonly string[], studentId?: string) => Promise<Array<{ lessonId: string, locked: boolean, includesStudent: boolean }>>
  referencedLessonSessionIds: (schoolId: string, sessionIds: readonly string[]) => Promise<string[]>
  find: (schoolId: string, id: string) => Promise<TeacherCorrection | undefined>
  save: (row: TeacherCorrection) => Promise<void>
  forTarget: (schoolId: string, workflow: CorrectionWorkflow, targetId: string) => Promise<TeacherCorrection[]>
  list: (scope: ResourceAccessScope, input: { workflow: CorrectionWorkflow, status: TeacherCorrection['status'], offset: number, limit: number, classGroupId?: string, periodId?: string, teacherSubjectId?: string, studentId?: string, search?: string, from?: Date, to?: Date }) => Promise<{ items: TeacherCorrection[], total: number }>
  state: (schoolId: string, workflow: CorrectionWorkflow, targetId: string) => Promise<TeacherWorkflowState | undefined>
  saveState: (state: TeacherWorkflowState) => Promise<void>
}
