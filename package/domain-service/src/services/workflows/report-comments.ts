import type { BaseSchoolService } from '../base-school-service'
import { BusinessRuleViolationError, ReportCardResult, ReportCardResultSection } from '@edaya/core'
import { academicStateLock } from '../../capabilities/academics/marks-state'
import { schoolCommandScope } from '../commands/school-command-scope'

export interface ReportCommentInput {
  requestId: string
  expectedVersion: number
  id: string
}
export interface HomeroomCommentInput extends ReportCommentInput { teacherComment: string }
export interface SectionCommentsInput extends ReportCommentInput { sections: Array<{ sectionId: string, comment?: string | null }> }

export async function writeReportComments(base: BaseSchoolService, input: HomeroomCommentInput | SectionCommentsInput): Promise<ReportCardResult> {
  const command = 'sections' in input ? 'writeReportCardSectionComments' : 'writeHomeroomReportComment'
  const requireResult = async (id: string) => {
    // Display projections suppress stale ranks and may show the last ready
    // publication. Patch the authorized canonical record instead.
    const scope = await base.access.entity('results').readScope()
    const result = await base.repositories.results.forAccess(scope).findById(id)
    if (!result)
      throw new BusinessRuleViolationError('REPORT_CARD_NOT_FOUND', 'Report card not found')
    return result
  }
  const propose = (existing: ReportCardResult): ReportCardResult => {
    let sectionResults = [...existing.sectionResults]
    if ('sections' in input) {
      const patches = new Map(input.sections.map(row => [row.sectionId, row.comment?.trim() || undefined]))
      if (patches.size !== input.sections.length)
        throw new BusinessRuleViolationError('REPORT_CARD_COMMENT_INVALID_SECTION', 'A section may be edited only once per command')
      const patch = (nodes: readonly ReportCardResultSection[]): ReportCardResultSection[] => nodes.map((section) => {
        const comment = patches.has(section.sectionId) ? patches.get(section.sectionId) : section.comment
        patches.delete(section.sectionId)
        return new ReportCardResultSection({ ...section.data, comment, subResults: patch(section.subResults) })
      })
      sectionResults = patch(existing.sectionResults)
      if (patches.size)
        throw new BusinessRuleViolationError('REPORT_CARD_COMMENT_INVALID_SECTION', 'One or more sections do not belong to this report')
    }
    return new ReportCardResult({
      ...existing.data,
      sectionResults,
      version: existing.version,
      ...('teacherComment' in input ? { teacherComment: input.teacherComment } : {}),
    })
  }
  return base.commandExecution.execute({
    scope: await schoolCommandScope(base.actor, command, input.requestId),
    input,
    resultMode: 'ordinary',
    lockKeys: [academicStateLock(base.actor.schoolId)],
    authorize: async () => {
      const existing = await requireResult(input.id)
      await base.access.entity('results').assertSave(propose(existing), existing)
    },
    execute: async () => {
      const existing = await requireResult(input.id)
      if (existing.version !== input.expectedVersion)
        throw new BusinessRuleViolationError('REPORT_CARD_VERSION_CONFLICT', 'The report card changed. Reload before applying this comment')
      const proposed = propose(existing)
      const result = new ReportCardResult({ ...proposed.data, sectionResults: [...proposed.sectionResults], version: existing.version + 1 })
      await base.entities.results.save(result)
      return result
    },
    persistResult: result => ({ id: result.id }),
    replay: stored => requireResult(stored.id),
    audit: result => [{ event: command, resourceType: 'results', resourceId: result.id }],
  })
}
