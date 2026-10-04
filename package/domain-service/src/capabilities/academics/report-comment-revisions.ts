/* eslint-disable dot-notation -- TypeScript requires bracket access for command-owned payload index signatures. */
import type { ReportCardResult, TeacherWorkflowState } from '@edaya/core'
import { ReportCardResultSection, ReportCardResult as Result } from '@edaya/core'

export function hydrateReportRevision(snapshot: unknown): ReportCardResult {
  const input = snapshot as ReportCardResult['data']
  const sections = (nodes: readonly ReportCardResultSection[]): ReportCardResultSection[] => nodes.map(node => new ReportCardResultSection({ ...node, subResults: sections(node.subResults) }))
  return new Result({ ...input, sectionResults: sections(input.sectionResults) })
}
export function visibleReportRevision(original: ReportCardResult, state?: TeacherWorkflowState): ReportCardResult {
  const snapshot = state?.payload['visibleSnapshot']
  return snapshot ? hydrateReportRevision(snapshot) : original
}
