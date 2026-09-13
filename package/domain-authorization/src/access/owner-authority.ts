import { Permission, permissionScope } from '@edaya/core'

/** Ownership admits school actions; platform authority remains a separate selected profile. */
export const SCHOOL_OWNER_ACTIONS: readonly Permission[] = Object.values(Permission)
  .filter(permission => permissionScope(permission) !== 'platform')
