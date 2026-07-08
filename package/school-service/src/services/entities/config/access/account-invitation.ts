import type { AccountInvitation } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { AccessControlOperations, denyResourceAccess } from '@edaya/authorization'
import { config, noopReadAccess, operationModule, read, write } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

async function denyInvitationEntityWrite(): Promise<void> {
  denyResourceAccess()
}

// Extracted from domain/access/account-invitation.ts (PR3)
export const accountInvitationConfig: EntityConfigFactory<AccountInvitation> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.accountInvitations,
    tenant: directSchoolTenant(),
    read: read(operationModule(AccessControlOperations.assign), noopReadAccess),
    write: write(
      operationModule(AccessControlOperations.assign),
      denyInvitationEntityWrite,
      denyInvitationEntityWrite,
    ),
    atomicExecution,
  })
