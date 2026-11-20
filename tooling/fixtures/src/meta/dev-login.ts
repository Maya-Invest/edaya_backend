import { resolveDevSeedContext } from './resolve-dev-seed-context'

export { DEV_AUTH_PASSWORD } from './dev-auth-fixtures'

export type DevDemoLoginRole = 'owner' | 'directeur' | 'deputy_director' | 'educateur'

export interface DevDemoLoginAccount {
  staffId: string
  email: string
  name: string
  role: DevDemoLoginRole
  initials: string
}

const ACCESS_ROLE_TO_DEMO_ROLE: Record<string, DevDemoLoginRole> = {
  'role-director': 'directeur',
  'role-coordinator': 'deputy_director',
  'role-educator': 'educateur',
}

const DEMO_ROLE_DISPLAY_ORDER: Record<DevDemoLoginRole, number> = {
  owner: -1,
  directeur: 0,
  deputy_director: 1,
  educateur: 2,
}

export function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts[parts.length - 1]?.[0] ?? ''
  return `${first}${last}`.toUpperCase()
}

export function resolveDevDemoStaffRole(
  staffId: string,
  context = resolveDevSeedContext(),
): { role: DevDemoLoginRole, accessRoleId?: string } {
  if (staffId === context.ownerStaffId) {
    return {
      role: 'owner',
      accessRoleId: context.staffAccessRoleIds[staffId],
    }
  }

  const accessRoleId = context.staffAccessRoleIds[staffId]
  const role = accessRoleId && ACCESS_ROLE_TO_DEMO_ROLE[accessRoleId]
    ? ACCESS_ROLE_TO_DEMO_ROLE[accessRoleId]
    : 'directeur'

  return { role, accessRoleId }
}

export function buildDevDemoLoginAccounts(): DevDemoLoginAccount[] {
  const context = resolveDevSeedContext()

  const accounts = context.staffAccounts.flatMap((account) => {
    const { role, accessRoleId } = resolveDevDemoStaffRole(account.staffId, context)
    if (!accessRoleId) {
      return []
    }

    return [{
      staffId: account.staffId,
      email: account.email,
      name: account.name,
      role,
      initials: initialsForName(account.name),
    }]
  })

  return accounts.sort((left, right) => {
    const roleOrder = DEMO_ROLE_DISPLAY_ORDER[left.role] - DEMO_ROLE_DISPLAY_ORDER[right.role]
    if (roleOrder !== 0) {
      return roleOrder
    }
    return left.name.localeCompare(right.name, 'fr')
  })
}

/** Dev login picker accounts for the webapp `/login` page. */
export function getDevDemoLoginAccounts(): DevDemoLoginAccount[] {
  return buildDevDemoLoginAccounts()
}
