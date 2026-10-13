import type { GradingPolicy } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError, GradeLevel, gradingPolicySchema, ReportCardDefinition } from '@edaya/core'
import { GRADING_RECALCULATE_KIND } from '../../capabilities/academics/grading'
import { academicStateLock } from '../../capabilities/academics/marks-state'
import { normalizeCommandRequest } from '../commands/command-execution'
import { schoolCommandScope } from '../commands/school-command-scope'

export interface ConfigureGradingInput {
  requestId: string
  gradeLevelId: string
  academicYearId: string
  scaleId: string
  expectedScaleRevision?: number
  mode: GradingPolicy['mode']
  aggregateLabel: string
  numericEquivalents?: Record<string, number>
  expectedRevision: number
  confirmed: boolean
}
export interface RetryGradingInput { requestId: string, gradeLevelId: string, academicYearId: string, expectedRevision: number }

function calculationSettings(policy: Pick<GradingPolicy, 'mode' | 'scale' | 'numericEquivalents'>): string {
  const { minScore, maxScore, decimalPlaces, roundingMode, ranges } = policy.scale
  return normalizeCommandRequest({ scaleId: policy.scale.id, mode: policy.mode, minScore, maxScore, decimalPlaces, roundingMode, ranges, numericEquivalents: policy.numericEquivalents })
}

export class GradingConfigurationWorkflow {
  constructor(private readonly base: BaseSchoolService) {}

  private async level(id: string): Promise<GradeLevel> {
    const level = await this.base.repositories.gradeLevels.findById(id)
    if (!level || level.schoolId !== this.base.actor.schoolId)
      denyResourceAccess()
    return level
  }

  private async currentYear(id: string): Promise<void> {
    const year = await this.base.repositories.academicYears.findById(id)
    if (!year || year.schoolId !== this.base.actor.schoolId)
      denyResourceAccess()
    if (year.status !== 'published' || !year.contains(new Date()))
      throw new BusinessRuleViolationError('GRADING_CURRENT_YEAR_REQUIRED', 'Grading changes apply only to the current published academic year')
  }

  async configure(input: ConfigureGradingInput): Promise<GradeLevel> {
    let queued: string | undefined
    return this.base.commandExecution.execute({
      scope: await schoolCommandScope(this.base.actor, 'configureGrading', input.requestId),
      input,
      resultMode: 'ordinary',
      lockKeys: [academicStateLock(this.base.actor.schoolId)],
      authorize: async () => {
        const level = await this.level(input.gradeLevelId)
        await this.base.access.reportCards.assertConfigureGrading(level, level)
        await this.currentYear(input.academicYearId)
      },
      execute: async () => {
        const level = await this.level(input.gradeLevelId)
        const previous = level.gradingPolicyFor(input.academicYearId)
        if ((previous?.revision ?? 0) !== input.expectedRevision)
          throw new BusinessRuleViolationError('GRADING_REVISION_CONFLICT', 'Reload this grading configuration before saving')
        const scale = await this.base.repositories.gradeScales.findById(input.scaleId)
        if (!scale || scale.schoolId !== level.schoolId)
          denyResourceAccess()
        if (input.expectedScaleRevision !== undefined && input.expectedScaleRevision !== scale.revision)
          throw new BusinessRuleViolationError('GRADING_REVISION_CONFLICT', 'Reload the scale before applying this grading configuration')
        const policy = gradingPolicySchema.parse({ academicYearId: input.academicYearId, revision: (previous?.revision ?? 0) + 1, mode: input.mode, aggregateLabel: input.aggregateLabel, scale: scale.data, numericEquivalents: input.numericEquivalents ?? previous?.numericEquivalents ?? {} })
        // Original mention references are stable across every revision of this year.
        // Require explicit equivalents without scanning student records in a save request.
        for (const historical of level.gradingPolicies.filter(row => row.academicYearId === input.academicYearId && row.mode === 'mention-first')) {
          for (const range of historical.scale.ranges) {
            if (policy.mode === 'numeric-first' && policy.numericEquivalents[`${historical.revision}:${range.id}`] === undefined)
              throw new BusinessRuleViolationError('GRADING_NUMERIC_EQUIVALENT_REQUIRED', 'Provide numeric equivalents for every previously available mention')
            if (policy.mode === 'mention-first' && !policy.scale.ranges.some(current => current.id === range.id) && (range.gpaValue ?? 0) > policy.scale.maxScore)
              throw new BusinessRuleViolationError('GRADING_ORIGINAL_MENTION_MISSING', 'A removed mention has points outside the new scale; retain its identifier and assign valid points')
          }
        }
        const changed = !previous || calculationSettings(previous) !== calculationSettings(policy)
        if (changed && !input.confirmed)
          throw new BusinessRuleViolationError('GRADING_CONFIRMATION_REQUIRED', 'Confirm recalculation for the current academic year')
        let policies = level.gradingPolicies
        if (changed) {
          queued = crypto.randomUUID()
          policies = [...policies, { ...policy, status: 'updating', workId: queued, cursor: { phase: 'marks', classId: '', assessmentId: '', afterId: '' } }]
        }
        else {
          policies = policies.map(row => row === previous ? { ...row, aggregateLabel: policy.aggregateLabel } : row)
        }
        const updated = new GradeLevel({ ...level.data, gradingPolicies: policies })
        const scope = await this.base.access.reportCards.assertConfigureGrading(updated, level)
        await this.base.repositories.gradeLevels.forAccess(scope).save(updated)
        const definitions = await this.base.repositories.definitions.list({ schoolId: level.schoolId, gradeLevelId: level.id, academicYearId: input.academicYearId })
        for (const definition of definitions) {
          if (definition.gradeScaleId !== scale.id)
            await this.base.repositories.definitions.forSchool!(level.schoolId).save(new ReportCardDefinition({ ...definition.data, gradeScaleId: scale.id }))
        }
        return updated
      },
      persistResult: result => ({ id: result.id }),
      replay: stored => this.level(stored.id),
      audit: result => [{ event: 'configureGrading', resourceType: 'gradeLevels', resourceId: result.id }],
      outbox: result => queued ? [{ id: queued, kind: GRADING_RECALCULATE_KIND, version: 1, resourceType: 'gradeLevels', resourceId: result.id }] : [],
    })
  }

  async retry(input: RetryGradingInput): Promise<GradeLevel> {
    let queued: string | undefined
    return this.base.commandExecution.execute({
      scope: await schoolCommandScope(this.base.actor, 'retryGrading', input.requestId),
      input,
      resultMode: 'ordinary',
      lockKeys: [academicStateLock(this.base.actor.schoolId)],
      authorize: async () => {
        const level = await this.level(input.gradeLevelId)
        await this.base.access.reportCards.assertConfigureGrading(level, level)
        await this.currentYear(input.academicYearId)
      },
      execute: async () => {
        const level = await this.level(input.gradeLevelId)
        const policy = level.gradingPolicyFor(input.academicYearId)
        if (!policy || policy.revision !== input.expectedRevision || policy.status === 'completed')
          throw new BusinessRuleViolationError('GRADING_RETRY_CONFLICT', 'This configuration no longer requires an update')
        queued = crypto.randomUUID()
        const updated = new GradeLevel({ ...level.data, gradingPolicies: level.gradingPolicies.map(row => row === policy ? { ...row, status: 'updating', failureCode: undefined, workId: queued } : row) })
        await this.base.repositories.gradeLevels.forSchool!(level.schoolId).save(updated)
        return updated
      },
      persistResult: result => ({ id: result.id }),
      replay: stored => this.level(stored.id),
      audit: result => [{ event: 'retryGrading', resourceType: 'gradeLevels', resourceId: result.id }],
      outbox: result => queued ? [{ id: queued, kind: GRADING_RECALCULATE_KIND, version: 1, resourceType: 'gradeLevels', resourceId: result.id }] : [],
    })
  }
}
