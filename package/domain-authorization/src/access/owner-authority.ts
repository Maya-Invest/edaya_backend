import { corePermissionDefinition, Permission } from '@edaya/core'

/** Ownership admits school actions; platform authority remains a separate selected profile. */
export const SCHOOL_OWNER_ACTIONS: readonly Permission[] = Object.values(Permission)
  .filter(permission => corePermissionDefinition(permission).scopePolicy.mode !== 'platform')
