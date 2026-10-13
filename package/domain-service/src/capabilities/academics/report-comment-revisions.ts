/* eslint-disable dot-notation -- TypeScript requires bracket access for command-owned payload index signatures. */
import type { ReportCardResult, TeacherWorkflowState } from '@edaya/core'
import { ReportCardAggregationSource, ReportCardResultSection, ReportCardResult as Result } from '@edaya/core'

export function hydrateReportRevision(snapshot: unknown): ReportCardResult {
  const input = snapshot as ReportCardResult['data']
  const sections = (nodes: readonly ReportCardResultSection[]): ReportCardResultSection[] => nodes.map(node => new ReportCardResultSection({ ...(node.data ?? node), subResults: sections(node.subResults) }))
  return new Result({ ...input, sectionResults: sections(input.sectionResults) })
}
export function visibleReportRevision(original: ReportCardResult, state?: TeacherWorkflowState): ReportCardResult {
  const snapshot = state?.payload['visibleSnapshot']
  return snapshot ? applyReportCommentRevision(original, snapshot) : original
}

/** An annual regeneration must retain its current grades when applying historical feedback. */
export function applyReportCommentRevision(original: ReportCardResult, snapshot: unknown): ReportCardResult {
  const revised = hydrateReportRevision(snapshot)
  if (!original.grading && !original.revisedDraft && original.gradingPolicyRevision === undefined && original.aggregation?.source !== ReportCardAggregationSource.ReportCards)
    return revised
  const comments = new Map<string, string | undefined>()
  const collect = (nodes: readonly ReportCardResultSection[]) => {
    for (const node of nodes) {
      comments.set(node.sectionId, node.comment)
      collect(node.subResults)
    }
  }
  collect(revised.sectionResults)
  const sections = (nodes: readonly ReportCardResultSection[]): ReportCardResultSection[] => nodes.map(node => new ReportCardResultSection({ ...(node.data ?? node), comment: comments.has(node.sectionId) ? comments.get(node.sectionId) : node.comment, subResults: sections(node.subResults) }))
  return new Result({ ...original.data, teacherComment: revised.teacherComment, principalComment: revised.principalComment, sectionResults: sections(original.sectionResults) })
}
