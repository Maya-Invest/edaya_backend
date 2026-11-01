import type { ReportModule } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { BusinessRuleViolationError } from '@edaya/core'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

export const reportModuleConfig: EntityConfigFactory<ReportModule> = ({ repositories, atomicExecution }) => config({
  repository: repositories.reportModules,
  tenant: directSchoolTenant(),
  resource: 'reportModules',
  writeLockGroup: 'academic-state',
  gates: {
    preSave: async () => { throw new BusinessRuleViolationError('REPORT_CONFIGURATION_COMMAND_REQUIRED', 'Use the report module configuration command') },
    preDelete: async () => { throw new BusinessRuleViolationError('REPORT_CONFIGURATION_COMMAND_REQUIRED', 'Use the report module configuration command') },
  },
  atomicExecution,
})
