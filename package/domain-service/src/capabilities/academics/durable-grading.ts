import type { ClaimedDurableWork, GradingPolicy } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import type { SchoolApplication } from '../../services/school-application'
import { createSystemActorMetadata } from '@edaya/authorization'
import { GradeLevel, ReportCardAggregationSource, ReportCardResult, ReportCardResultStatus, withShortName } from '@edaya/core'
import { schoolCommandScope } from '../../services/commands/school-command-scope'
import { AssessmentsServiceWorkflow } from '../../services/workflows/assessments'
import { DurableWorkFailure, runDurableWorkBatch } from '../scheduling-jobs/durable-work'
import { GRADING_RECALCULATE_KIND, recalculateGrade } from './grading'
import { academicStateLock } from './marks-state'

const PAGE_SIZE = 50
const phases = ['marks', 'reports', 'annual', 'rankings', 'done'] as const
type Cursor = NonNullable<GradingPolicy['cursor']>

async function advance(base: BaseSchoolService, level: GradeLevel, policy: GradingPolicy): Promise<Cursor> {
  const repositories = base.repositories
  const cursor: Cursor = policy.cursor ?? { phase: 'marks', classId: '', assessmentId: '', afterId: '' }
  const group = cursor.classId
    ? await repositories.classGroups.findById(cursor.classId)
    : await repositories.classGroups.findOne({ schoolId: level.schoolId, gradeLevelId: level.id, academicYearId: policy.academicYearId, $orderBy: [{ field: 'id', direction: 'asc' }] })
  const nextClass = async (): Promise<Cursor> => {
    const next = await repositories.classGroups.findOne({ schoolId: level.schoolId, gradeLevelId: level.id, academicYearId: policy.academicYearId, id: { $gt: group?.id ?? '' }, $orderBy: [{ field: 'id', direction: 'asc' }] })
    return { phase: next ? cursor.phase : phases[phases.indexOf(cursor.phase) + 1] ?? 'done', classId: next?.id ?? '', assessmentId: '', afterId: '' }
  }
  if (!group)
    return { ...cursor, phase: phases[phases.indexOf(cursor.phase) + 1] ?? 'done', classId: '', assessmentId: '', afterId: '' }
  if (group.schoolId !== level.schoolId || group.gradeLevelId !== level.id || group.academicYearId !== policy.academicYearId)
    throw new DurableWorkFailure('GRADING_SCOPE_CHANGED', true)
  if (cursor.phase === 'marks') {
    const assessment = cursor.assessmentId
      ? await repositories.assessments.findById(cursor.assessmentId)
      : await repositories.assessments.findOne({ classGroupId: group.id, $orderBy: [{ field: 'id', direction: 'asc' }] })
    if (!assessment)
      return nextClass()
    const rows = await repositories.assessmentResults.list({ assessmentId: assessment.id, id: { $gt: cursor.afterId }, $orderBy: [{ field: 'id', direction: 'asc' }], $limit: PAGE_SIZE })
    for (const result of rows)
      await repositories.assessmentResults.forSchool!(level.schoolId).save(recalculateGrade(result, assessment, policy))
    if (rows.length === PAGE_SIZE)
      return { ...cursor, classId: group.id, assessmentId: assessment.id, afterId: rows.at(-1)!.id }
    const next = await repositories.assessments.findOne({ classGroupId: group.id, id: { $gt: assessment.id }, $orderBy: [{ field: 'id', direction: 'asc' }] })
    return next ? { ...cursor, classId: group.id, assessmentId: next.id, afterId: '' } : nextClass()
  }
  if (cursor.phase === 'reports' || cursor.phase === 'annual') {
    // Report generation loads a student's dependencies; keep the page deliberately small.
    const rows = await repositories.results.list({ classGroupId: group.id, id: { $gt: cursor.afterId }, $orderBy: [{ field: 'id', direction: 'asc' }], $limit: 5 })
    const regenerate = async (original: ReportCardResult): Promise<void> => {
      const generated = await new AssessmentsServiceWorkflow(base).buildReportCardResult({ id: original.id, studentId: original.studentId, periodId: original.periodId, aggregation: original.aggregation }, false, true)
      const updated = original.status === ReportCardResultStatus.Published
        ? new ReportCardResult({ ...original.data, sectionResults: [...original.sectionResults], revisedDraft: { ...generated.data, sectionResults: [...generated.sectionResults] } })
        : generated
      await repositories.results.forSchool!(level.schoolId).save(updated)
    }
    const current = (result: ReportCardResult) => {
      const snapshot = result.revisedDraft ?? result
      return snapshot.gradingPolicyRevision === policy.revision && !snapshot.calculationStale
    }
    // Walk dependency metadata but rebuild at most one prerequisite per page.
    // Repeating the page is safe: already current snapshots are not duplicated.
    const prepareDependencies = async (result: ReportCardResult, visiting = new Set<string>()): Promise<boolean> => {
      if (visiting.has(result.id) || visiting.size >= 64)
        throw new DurableWorkFailure('GRADING_REPORT_DEPENDENCY_CYCLE', true)
      visiting.add(result.id)
      if (result.aggregation?.source === ReportCardAggregationSource.ReportCards) {
        for (const periodId of result.aggregation.sourcePeriodIds) {
          const source = await repositories.results.findOne({ studentId: result.studentId, periodId })
          if (!source || current(source))
            continue
          const period = await repositories.academicPeriods.findById(periodId)
          if (period?.academicYearId !== policy.academicYearId || source.classGroupId !== group.id)
            throw new DurableWorkFailure('GRADING_REPORT_DEPENDENCY_SCOPE', true)
          if (await prepareDependencies(source, visiting))
            await regenerate(source)
          return false
        }
      }
      visiting.delete(result.id)
      return true
    }
    for (const original of rows) {
      const isAnnual = original.aggregation?.source === ReportCardAggregationSource.ReportCards
      if (isAnnual !== (cursor.phase === 'annual') || current(original))
        continue
      if (!await prepareDependencies(original))
        return { ...cursor, classId: group.id }
      await regenerate(original)
    }
    return rows.length === 5 ? { ...cursor, classId: group.id, afterId: rows.at(-1)!.id } : nextClass()
  }
  if (cursor.phase === 'rankings') {
    // Teacher edits may have invalidated an earlier batch while work was running.
    // Restart that class's calculation instead of exposing mixed ranks.
    const stale = await repositories.results.findOne({ classGroupId: group.id, calculationStale: true, status: ReportCardResultStatus.Draft })
    if (stale)
      return { phase: 'reports', classId: group.id, assessmentId: '', afterId: '' }
    await repositories.assessmentDependencies.refreshGradingRankings({ schoolId: level.schoolId, classGroupId: group.id, policyRevision: policy.revision })
    return nextClass()
  }
  return cursor
}

async function runPage(application: Pick<SchoolApplication, 'forActor'>, work: ClaimedDurableWork): Promise<void> {
  const base = application.forActor(createSystemActorMetadata({ schoolId: work.schoolId, systemId: 'grading-recalculation', requestId: work.id, reason: 'recalculate an explicitly applied grading revision' })).baseService
  let nextId: string | undefined
  await base.commandExecution.execute({
    scope: await schoolCommandScope(base.actor, 'recalculateGradingPage', work.id),
    input: { workId: work.id },
    resultMode: 'ordinary',
    lockKeys: [academicStateLock(work.schoolId)],
    authorize: async () => {
      const level = await base.repositories.gradeLevels.findById(work.resourceId)
      if (!level || level.schoolId !== work.schoolId)
        throw new DurableWorkFailure('GRADING_SCOPE_CHANGED', true)
    },
    execute: async () => {
      const level = (await base.repositories.gradeLevels.findById(work.resourceId))!
      const policy = level.gradingPolicies.find(row => row.workId === work.id)
      if (!policy || level.gradingPolicyFor(policy.academicYearId)?.revision !== policy.revision || policy.status === 'completed')
        return { id: level.id }
      const year = await base.repositories.academicYears.findById(policy.academicYearId)
      if (!year || year.status !== 'published' || !year.contains(new Date()))
        throw new DurableWorkFailure('GRADING_CURRENT_YEAR_REQUIRED', true)
      let cursor = await advance(base, level, policy)
      if (cursor.phase === 'done') {
        const pending = await base.repositories.assessmentDependencies.pendingGradingClass({ schoolId: work.schoolId, gradeLevelId: level.id, academicYearId: policy.academicYearId, policyRevision: policy.revision })
        if (pending)
          cursor = { phase: 'reports', classId: pending, assessmentId: '', afterId: '' }
      }
      nextId = cursor.phase === 'done' ? undefined : crypto.randomUUID()
      const updated = new GradeLevel(withShortName({ ...level.data, gradingPolicies: level.gradingPolicies.map(row => row === policy ? { ...row, cursor, workId: nextId, status: cursor.phase === 'done' ? 'completed' : 'updating', failureCode: undefined } : row) }))
      await base.repositories.gradeLevels.forSchool!(work.schoolId).save(updated)
      return { id: level.id }
    },
    persistResult: result => result,
    replay: async stored => stored,
    audit: result => [{ event: 'recalculateGradingPage', resourceType: 'gradeLevels', resourceId: result.id }],
    outbox: result => nextId ? [{ id: nextId, kind: GRADING_RECALCULATE_KIND, version: 1, resourceType: 'gradeLevels', resourceId: result.id }] : [],
  })
}

export async function dispatchGradingRecalculation(application: Pick<SchoolApplication, 'forActor' | 'durableWork'>) {
  return runDurableWorkBatch(application.durableWork, {
    [GRADING_RECALCULATE_KIND]: { version: 1, run: async (work) => {
      try {
        await runPage(application, work)
      }
      catch (error) {
        const base = application.forActor(createSystemActorMetadata({ schoolId: work.schoolId, systemId: 'grading-recalculation', requestId: work.id, reason: 'record grading update failure' })).baseService
        await base.atomicExecution.execute(async () => {
          const level = await base.repositories.gradeLevels.forSchool!(work.schoolId).findById(work.resourceId)
          if (level)
            await base.repositories.gradeLevels.forSchool!(work.schoolId).save(new GradeLevel(withShortName({ ...level.data, gradingPolicies: level.gradingPolicies.map(row => row.workId === work.id ? { ...row, status: 'failed', failureCode: 'GRADING_UPDATE_FAILED' } : row) })))
        }, { lockKeys: [academicStateLock(work.schoolId)] })
        throw error
      }
    } },
  }, { limit: 2, leaseMs: 300000 })
}
