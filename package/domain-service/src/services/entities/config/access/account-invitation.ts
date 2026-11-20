import type { AccountInvitation } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'

import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/access/account-invitation.ts (PR3)
export const accountInvitationConfig: EntityConfigFactory<AccountInvitation> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.accountInvitations,
    tenant: directSchoolTenant(),
    resource: 'accountInvitations',

    atomicExecution,
  })
