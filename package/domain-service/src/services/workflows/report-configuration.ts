import type { ReportModuleInput } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError, GradeLevel, ReportModule } from '@edaya/core'
import { academicStateLock } from '../../capabilities/academics/marks-state'
import { invalidateReportConfiguration } from '../../capabilities/academics/report-configuration'
import { schoolCommandScope } from '../commands/school-command-scope'

export interface ReportConfigurationScope { gradeLevelId: string, academicYearId: string }
export interface ConfigureReportModulesInput extends ReportConfigurationScope {
  requestId: string
  expectedRevision: number
  action: 'save' | 'delete' | 'assign'
  module?: Pick<ReportModuleInput, 'id' | 'name' | 'order' | 'weightingMode' | 'explicitWeight'>
  moduleId?: string | null
  assignments?: Array<{ subjectId: string, moduleId: string | null, order?: number }>
}
export interface ConfigureReportSettingsInput extends ReportConfigurationScope {
  requestId: string
  expectedRevision: number
  passThreshold?: number | null
}

export class ReportConfigurationWorkflow {
  constructor(private readonly base: BaseSchoolService) {}

  private async level(input: ReportConfigurationScope) {
    const level = await this.base.repositories.gradeLevels.findById(input.gradeLevelId)
    const year = await this.base.repositories.academicYears.findById(input.academicYearId)
    if (!level || !year || level.schoolId !== this.base.actor.schoolId || year.schoolId !== level.schoolId)
      denyResourceAccess()
    return level
  }

  async read(input: ReportConfigurationScope) {
    const level = await this.level(input)
    const scopes = await this.base.access.reportCards.configurationScopes(level.id)
    const subjects = await this.base.repositories.subjects.forAccess(scopes.subjects).list({ gradeLevelId: level.id, academicYearId: input.academicYearId })
    const modules = await this.base.repositories.reportModules.forAccess(scopes.modules).list({ gradeLevelId: level.id, academicYearId: input.academicYearId, $orderBy: [{ field: 'order', direction: 'asc' }] })
    const categoryIds = [...new Set(subjects.map(subject => subject.categoryId))]
    const categories = categoryIds.length ? await this.base.repositories.subjectCategories.forSchool!(level.schoolId).list({ id: { $in: categoryIds } }) : []
    const categoryNames = new Map(categories.map(row => [row.id, row.name]))
    // Only curriculum fields: chapter/logbook access remains independently authorized.
    return { gradeLevelId: level.id, academicYearId: input.academicYearId, settings: level.reportSettingsFor(input.academicYearId), modules: modules.map(row => row.data), subjects: subjects.map(row => ({ ...row.data, categoryName: categoryNames.get(row.categoryId) })) }
  }

  async configure(input: ConfigureReportModulesInput | ConfigureReportSettingsInput) {
    const command = 'action' in input ? 'configureReportModules' : 'configureReportSettings'
    return this.base.commandExecution.execute({
      scope: await schoolCommandScope(this.base.actor, command, input.requestId),
      input,
      resultMode: 'ordinary',
      lockKeys: [academicStateLock(this.base.actor.schoolId)],
      authorize: async () => {
        const level = await this.level(input)
        await this.base.access.reportCards.assertConfigureGrading(level, level)
      },
      execute: async () => {
        const level = await this.level(input)
        const settings = level.reportSettingsFor(input.academicYearId)
        if (settings.revision !== input.expectedRevision)
          throw new BusinessRuleViolationError('REPORT_CONFIGURATION_REVISION_CONFLICT', 'Reload the subjects and modules before saving')
        const repositories = this.base.repositories
        const scoped = repositories.reportModules.forSchool!(level.schoolId)
        const requireModule = async (id: string) => {
          const module = await scoped.findById(id)
          if (!module || module.gradeLevelId !== level.id || module.academicYearId !== input.academicYearId)
            denyResourceAccess()
          return module
        }
        if ('action' in input) {
          if (input.action === 'save') {
            if (!input.module)
              throw new BusinessRuleViolationError('REPORT_MODULE_REQUIRED', 'Provide module details')
            const existing = await repositories.reportModules.findById(input.module.id)
            if (existing)
              await requireModule(existing.id)
            await scoped.save(new ReportModule({ ...input.module, schoolId: level.schoolId, gradeLevelId: level.id, academicYearId: input.academicYearId, createdAt: existing?.createdAt }))
          }
          else if (input.action === 'delete') {
            if (!input.moduleId)
              throw new BusinessRuleViolationError('REPORT_MODULE_REQUIRED', 'Choose a module')
            const module = await requireModule(input.moduleId)
            for (const subject of await repositories.subjects.forSchool!(level.schoolId).list({ reportModuleId: module.id }))
              await repositories.subjects.forSchool!(level.schoolId).save(subject.copyWith({ reportModuleId: null }))
            await scoped.delete(module.id)
          }
          const assignments = input.assignments ?? []
          if (new Set(assignments.map(row => row.subjectId)).size !== assignments.length)
            throw new BusinessRuleViolationError('REPORT_SUBJECT_DUPLICATED', 'Assign each subject once per command')
          for (const assignment of assignments) {
            const subject = await repositories.subjects.findById(assignment.subjectId)
            if (!subject || subject.schoolId !== level.schoolId || subject.gradeLevelId !== level.id || subject.academicYearId !== input.academicYearId)
              denyResourceAccess()
            if (assignment.moduleId)
              await requireModule(assignment.moduleId)
            await repositories.subjects.forSchool!(level.schoolId).save(subject.copyWith({ reportModuleId: assignment.moduleId, reportOrder: assignment.order ?? subject.reportOrder }))
          }
        }
        else {
          const threshold = Object.hasOwn(input, 'passThreshold') ? input.passThreshold ?? undefined : settings.passThreshold
          if (threshold !== undefined) {
            const policy = level.gradingPolicyFor(input.academicYearId)
            const factor = 10 ** (policy?.scale.decimalPlaces ?? 2)
            if (!policy || !Number.isFinite(threshold) || threshold < policy.scale.minScore || threshold > policy.scale.maxScore || Math.abs(threshold * factor - Math.round(threshold * factor)) > Number.EPSILON * Math.max(1, threshold * factor) * 4)
              throw new BusinessRuleViolationError('INVALID_REPORT_PASS_THRESHOLD', 'Passing threshold must match the grading scale bounds and precision')
          }
          await repositories.gradeLevels.forSchool!(level.schoolId).save(new GradeLevel({ ...level.data, reportSettings: [...level.reportSettings.filter(row => row.academicYearId !== input.academicYearId), { ...settings, passThreshold: threshold }] }))
        }
        await invalidateReportConfiguration(repositories, level.id, input.academicYearId)
        return this.read(input)
      },
      persistResult: () => ({ gradeLevelId: input.gradeLevelId, academicYearId: input.academicYearId }),
      replay: stored => this.read(stored),
      audit: () => [{ event: command, resourceType: 'gradeLevels', resourceId: input.gradeLevelId }],
    })
  }
}
