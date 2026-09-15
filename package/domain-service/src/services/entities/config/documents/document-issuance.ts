import type { DocumentIssuance } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { BusinessRuleViolationError } from '@edaya/core'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

export const documentIssuanceConfig: EntityConfigFactory<DocumentIssuance> = ({ repositories, atomicExecution }) => {
  return config({
    repository: repositories.documentIssuances,
    tenant: directSchoolTenant(),
    resource: 'documentIssuances',
    gates: {
      preSave: async () => {
        throw new BusinessRuleViolationError('DOCUMENT_COMMAND_REQUIRED', 'Document issuances require a named issuance command')
      },
      preDelete: async () => {
        throw new BusinessRuleViolationError('DOCUMENT_COMMAND_REQUIRED', 'Document issuances cannot be deleted')
      },
    },
    atomicExecution,
  })
}
