import type { ReportCardResult } from '@edaya/core'
import { BusinessRuleViolationError, ReportCardResultSection } from '@edaya/core'

export function preserveReportComments(existing: ReportCardResult | undefined, definitionId: string, sections: readonly ReportCardResultSection[]): ReportCardResultSection[] {
  if (!existing)
    return [...sections]
  const comments = new Map<string, ReportCardResultSection>()
  const collect = (nodes: readonly ReportCardResultSection[]) => {
    for (const section of nodes) {
      if (section.comment)
        comments.set(section.sectionId, section)
      collect(section.subResults)
    }
  }
  collect(existing.sectionResults)
  const merge = (nodes: readonly ReportCardResultSection[]): ReportCardResultSection[] => nodes.map((section) => {
    const before = comments.get(section.sectionId)
    if (before) {
      if (definitionId !== existing.reportCardDefinitionId || before.sectionKind !== section.sectionKind || before.classSubjectId !== section.classSubjectId)
        throw new BusinessRuleViolationError('REPORT_CARD_COMMENT_REMAP_REQUIRED', 'Clear or reconcile comments whose section identity changed before regenerating')
      comments.delete(section.sectionId)
    }
    return new ReportCardResultSection({ ...section.data, comment: before?.comment, subResults: merge(section.subResults) })
  })
  const merged = merge(sections)
  if (comments.size)
    throw new BusinessRuleViolationError('REPORT_CARD_COMMENT_REMAP_REQUIRED', 'Clear comments on removed sections before regenerating')
  return merged
}
