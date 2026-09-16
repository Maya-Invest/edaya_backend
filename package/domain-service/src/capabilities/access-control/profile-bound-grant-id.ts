import type { Permission } from '@edaya/core'

export function profileBoundGrantId(staffId: string, profileId: string, permission: Permission): string {
  return `ppg:${staffId}:${profileId}:${permission}`
}
