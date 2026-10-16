import type { GradeScaleInput, GradeScaleRange, ReportCardDefinitionSectionInput } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError, GradeScale, rangesFromThresholds, ReportCardDefinition, ReportCardDefinitionSection } from '@edaya/core'
import { academicStateLock } from '../../capabilities/academics/marks-state'
import { schoolCommandScope } from '../commands/school-command-scope'

export interface ConfigureGradeScaleInput {
  requestId: string
  id: string
  expectedRevision: number
  action: 'metadata' | 'interval' | 'remove-interval' | 'convert' | 'delete'
  metadata?: Pick<GradeScaleInput, 'name' | 'minScore' | 'maxScore' | 'decimalPlaces' | 'roundingMode' | 'description'>
  interval?: Omit<GradeScaleRange, 'maxScore'> & { id: string }
  intervalId?: string
}
export interface ConfigureReportModelInput {
  requestId: string
  id: string
  expectedRevision: number
  action: 'metadata' | 'section' | 'remove-section'
  metadata?: { name: string, description?: string | null, passThreshold?: number | null }
  section?: Omit<ReportCardDefinitionSectionInput, 'reportCardDefinitionId' | 'createdAt'>
  sectionId?: string
}

export class ConfigurationEditorsWorkflow {
  constructor(private readonly base: BaseSchoolService) {}

  async configureScale(input: ConfigureGradeScaleInput): Promise<GradeScale> {
    return this.base.commandExecution.execute({
      scope: await schoolCommandScope(this.base.actor, 'configureGradeScale', input.requestId),
      input,
      resultMode: 'ordinary',
      lockKeys: [academicStateLock(this.base.actor.schoolId)],
      // Managed writes below authorize their existing and proposed targets in this transaction.
      authorize: async () => {},
      execute: async () => {
        const existing = await this.base.repositories.gradeScales.findById(input.id)
        if (existing && existing.schoolId !== this.base.actor.schoolId)
          denyResourceAccess()
        if ((existing?.revision ?? 0) !== input.expectedRevision)
          throw new BusinessRuleViolationError('GRADE_SCALE_REVISION_CONFLICT', 'Reload the scale before saving')
        if (!existing && (input.action !== 'metadata' || !input.metadata))
          throw new BusinessRuleViolationError('GRADE_SCALE_REQUIRED', 'Create the scale first')
        if (input.action === 'delete') {
          await this.base.entities.gradeScales.delete(existing!.id)
          return existing!
        }
        let data: GradeScaleInput = existing
          ? { ...existing.data, ranges: [...existing.ranges] }
          : {
              ...input.metadata!,
              id: input.id,
              schoolId: this.base.actor.schoolId,
              intervalConvention: 'continuous',
              ranges: [],
            }
        if (input.action === 'metadata') {
          if (!input.metadata)
            throw new BusinessRuleViolationError('SCALE_METADATA_REQUIRED', 'Scale details are required')
          data = { ...data, ...input.metadata }
        }
        else {
          if (input.action !== 'convert' && existing!.intervalConvention !== 'continuous')
            throw new BusinessRuleViolationError('GRADE_SCALE_CONVERSION_REQUIRED', 'Convert legacy intervals explicitly before editing thresholds')
          if (input.action === 'interval') {
            if (!input.interval)
              throw new BusinessRuleViolationError('INTERVAL_REQUIRED', 'An interval is required')
            data.ranges = [...data.ranges.filter(row => row.id !== input.interval!.id), { ...input.interval, maxScore: data.maxScore }]
          }
          if (input.action === 'remove-interval') {
            const ordered = [...data.ranges].sort((a, b) => a.minScore - b.minScore)
            if (!input.intervalId || !ordered.some(row => row.id === input.intervalId))
              throw new BusinessRuleViolationError('INTERVAL_REQUIRED', 'Choose an existing interval')
            if (ordered.length > 1 && ordered[0]?.id === input.intervalId)
              throw new BusinessRuleViolationError('BASE_INTERVAL_REQUIRED', 'The lowest interval must remain anchored to the scale minimum')
            data.ranges = ordered.filter(row => row.id !== input.intervalId)
          }
          if (input.action === 'convert') {
            data.intervalConvention = 'continuous'
            data.ranges = data.ranges.map(row => ({ ...row, id: row.id ?? crypto.randomUUID(), interpretation: row.interpretation ?? row.letter }))
          }
        }
        if (data.minScore >= data.maxScore)
          throw new BusinessRuleViolationError('INVALID_SCALE_BOUNDS', 'Scale minimum must be less than its maximum')
        if (data.intervalConvention === 'continuous')
          data.ranges = rangesFromThresholds(data.ranges.map(row => ({ ...row, gpaValue: row.gpaValue ?? undefined, interpretation: row.interpretation ?? undefined })), data.maxScore)
        await this.base.entities.gradeScales.save(new GradeScale(data))
        return (await this.base.repositories.gradeScales.findById(input.id))!
      },
      persistResult: result => ({ id: result.id, deleted: input.action === 'delete' ? JSON.stringify(result.data) : null }),
      replay: async stored => stored.deleted ? new GradeScale(JSON.parse(stored.deleted)) : (await this.base.entities.gradeScales.findById(stored.id))!,
      audit: result => [{ event: 'configureGradeScale', resourceType: 'gradeScales', resourceId: result.id }],
    })
  }

  async configureModel(input: ConfigureReportModelInput): Promise<ReportCardDefinition> {
    return this.base.commandExecution.execute({
      scope: await schoolCommandScope(this.base.actor, 'configureReportCardDefinition', input.requestId),
      input,
      resultMode: 'ordinary',
      lockKeys: [academicStateLock(this.base.actor.schoolId)],
      authorize: async () => {},
      execute: async () => {
        const existing = await this.base.repositories.definitions.findById(input.id)
        if (!existing || existing.schoolId !== this.base.actor.schoolId)
          denyResourceAccess()
        if (existing.revision !== input.expectedRevision)
          throw new BusinessRuleViolationError('REPORT_MODEL_REVISION_CONFLICT', 'Reload the report model before saving')
        if (input.action === 'metadata') {
          if (!input.metadata)
            throw new BusinessRuleViolationError('MODEL_METADATA_REQUIRED', 'Model details are required')
          await this.base.entities.definitions.save(new ReportCardDefinition({ ...existing.data, ...input.metadata }))
        }
        else if (input.action === 'section') {
          if (!input.section)
            throw new BusinessRuleViolationError('SECTION_REQUIRED', 'A section is required')
          const previous = await this.base.repositories.sections.findById(input.section.id)
          if (previous && previous.reportCardDefinitionId !== existing.id)
            denyResourceAccess()
          await this.base.entities.sections.save(new ReportCardDefinitionSection({ ...previous?.data, ...input.section, reportCardDefinitionId: existing.id }))
        }
        else {
          const section = input.sectionId ? await this.base.repositories.sections.findById(input.sectionId) : undefined
          if (!section || section.reportCardDefinitionId !== existing.id)
            denyResourceAccess()
          await this.base.entities.sections.delete(section.id)
        }
        return (await this.base.repositories.definitions.findById(existing.id))!
      },
      persistResult: result => ({ id: result.id }),
      replay: async stored => (await this.base.entities.definitions.findById(stored.id))!,
      audit: result => [{ event: 'configureReportCardDefinition', resourceType: 'definitions', resourceId: result.id }],
    })
  }
}
