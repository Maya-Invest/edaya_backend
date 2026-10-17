import type { SchoolRepositories } from '@edaya/service'
import { Permission } from '@edaya/core'

/** Uses current business records, never client-selected roles or provider claims. */
export async function accountRequiresPrivilegedTotp(repos: SchoolRepositories, accountId: string): Promise<boolean> {
  if ((await repos.platformUsers.findBySubjectId(accountId))?.isActive)
    return true
  if (await repos.schools.findOne({ ownerSubjectId: accountId }))
    return true
  const staff = await repos.staffMembers.list({ subjectId: accountId, isActive: true, accountKind: 'human' })
  const elevated = [Permission.ACCESS_CONTROL_MANAGE, Permission.ACCESS_CONTROL_MANAGE, Permission.SCHOOL_LIFECYCLE_MANAGE]
  const now = new Date()
  for (const member of staff) {
    const grants = await repos.staffPermissionAssignments.list({ staffId: member.id, status: 'active', permission: { $in: elevated } })
    if (grants.some(g => (!g.startsAt || g.startsAt <= now) && (!g.endsAt || g.endsAt > now)))
      return true
    const assignments = await repos.staffAssignments.list({ staffId: member.id })
    if (assignments.some(a => a.permissions.some(p => elevated.includes(p))))
      return true
  }
  return false
}
