import type { AccessPolicies } from '@edaya/authorization'
import type { ActiveReportComment, ReportCardResult, ReportCardResultSection } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { applyReportCommentRevision } from '../../capabilities/academics/report-comment-revisions'
import { loadInBatches } from '../../capabilities/shared/bounded-reads'

type Teaching = Awaited<ReturnType<AccessPolicies['teacherReportCommentTargets']>>

export interface GradebookComment {
  reportId: string
  sectionId: string
  text: string
  status: ReportCardResult['status']
  version: number
  calculationStale: boolean
  proposal: { text: string, status: ActiveReportComment['status'] } | null
}

function reportSections(nodes: readonly ReportCardResultSection[]) {
  const sections = new Map<string, ReportCardResultSection>()
  function visit(section: ReportCardResultSection) {
    sections.set(section.sectionId, section)
    section.subResults.forEach(visit)
  }
  nodes.forEach(visit)
  return sections
}

function canSeeProposal({ proposal }: ActiveReportComment, sections: ReadonlyMap<string, ReportCardResultSection>, teaching: Teaching) {
  if ('teacherComment' in proposal && !teaching.homeroom)
    return false
  return proposal.sections.every(({ sectionId }) => {
    const section = sections.get(sectionId)
    if (!section)
      return false
    return section.sectionKind === 'subject'
      ? !!section.classSubjectId && teaching.subjects.has(section.classSubjectId)
      : teaching.homeroom
  })
}

/** Projects the visible report revision and the current teacher's active proposal. */
export async function gradebookComments(
  base: BaseSchoolService,
  access: AccessPolicies,
  teaching: Teaching,
  input: { classGroupId: string, classSubjectId: string, periodId: string },
  studentIds: string[],
) {
  if (base.actor.kind !== 'teacher')
    denyResourceAccess()
  const { schoolId, subjectId } = base.actor
  const { classGroupId, classSubjectId, periodId } = input
  const reports = base.repositories.results.forAccess(await access.entity('results').readScope())
  const originals = await loadInBatches(studentIds, ids => reports.list({ classGroupId, periodId, studentId: { $in: ids } }))
  const store = base.repositories.teacherCorrections
  const snapshots = await loadInBatches(originals.map(row => row.id), ids => store.visibleReportSnapshots(schoolId, ids))
  const byId = new Map(snapshots.map(row => [row.reportId, row.snapshot]))
  const selected = originals.map((original) => {
    const snapshot = byId.get(original.id)
    const report = snapshot ? applyReportCommentRevision(original, snapshot) : original
    const sections = reportSections(report.sectionResults)
    const section = [...sections.values()].find(row => row.classSubjectId === classSubjectId)
    return { original, report, sections, section }
  })
  // A pupil can have a report without a corresponding section. The summary uses
  // the same single report per pupil as the other gradebook fields.
  const byStudent = new Map(selected.map(row => [row.report.studentId, row]))
  const publishedIds = Array.from(byStudent.values()).filter(row => row.section && row.report.status === 'published').map(row => row.original.id)
  const active = await loadInBatches(publishedIds, async (ids) => {
    const scope = await access.reportCards.teacherCommentProposalScope()
    const permitted = await base.repositories.results.forAccess(scope).count({ id: { $in: ids } })
    if (permitted !== ids.length)
      denyResourceAccess()
    return store.activeReportComments(schoolId, classGroupId, subjectId, ids)
  })
  // The partial unique index permits one active correction per report.
  const proposals = new Map(active.map(row => [row.proposal.targetId, row]))
  const comments = new Map<string, GradebookComment>()
  for (const [studentId, { original, report, sections, section }] of byStudent) {
    if (!section)
      continue
    let proposal: GradebookComment['proposal'] = null
    const candidate = proposals.get(original.id)
    if (candidate && canSeeProposal(candidate, sections, teaching)) {
      const storedSections = original === report ? sections : reportSections(original.sectionResults)
      const change = candidate.proposal.sections.find(row => row.sectionId === section.sectionId)
      if (change && (storedSections === sections || canSeeProposal(candidate, storedSections, teaching)))
        proposal = { text: change.comment ?? '', status: candidate.status }
    }
    comments.set(studentId, {
      reportId: report.id,
      sectionId: section.sectionId,
      text: section.comment ?? '',
      status: report.status,
      version: report.version,
      calculationStale: report.calculationStale,
      proposal,
    })
  }
  return comments
}
