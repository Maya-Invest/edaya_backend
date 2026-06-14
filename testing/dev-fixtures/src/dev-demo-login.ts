import {
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCESS_ROLE_IDS,
  DEV_AUTH_STAFF_ACCOUNTS,
} from './dataset'

export { DEV_AUTH_PASSWORD }

export type DevDemoLoginRole = 'directeur' | 'prof_principal' | 'professeur' | 'educateur'

export interface DevDemoLoginAccount {
  staffId: string
  email: string
  name: string
  role: DevDemoLoginRole
  initials: string
}

const ACCESS_ROLE_TO_DEMO_ROLE: Record<string, DevDemoLoginRole> = {
  'role-director': 'directeur',
  'role-coordinator': 'prof_principal',
  'role-educator': 'educateur',
  'role-teacher': 'professeur',
}

const DEMO_ROLE_DISPLAY_ORDER: Record<DevDemoLoginRole, number> = {
  directeur: 0,
  professeur: 1,
  prof_principal: 2,
  educateur: 3,
}

export function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts[parts.length - 1]?.[0] ?? ''
  return `${first}${last}`.toUpperCase()
}

export function resolveDevDemoStaffRole(
  staffId: string,
): { role: DevDemoLoginRole, accessRoleId?: string } {
  const accessRoleId = DEV_AUTH_STAFF_ACCESS_ROLE_IDS[
    staffId as keyof typeof DEV_AUTH_STAFF_ACCESS_ROLE_IDS
  ]
  const role = accessRoleId && ACCESS_ROLE_TO_DEMO_ROLE[accessRoleId]
    ? ACCESS_ROLE_TO_DEMO_ROLE[accessRoleId]
    : 'professeur'

  return { role, accessRoleId }
}

export function buildDevDemoLoginAccounts(): DevDemoLoginAccount[] {
  let teacherAccountIncluded = false

  const accounts = DEV_AUTH_STAFF_ACCOUNTS.flatMap((account) => {
    const { role, accessRoleId } = resolveDevDemoStaffRole(account.staffId)
    if (!accessRoleId) {
      return []
    }

    if (accessRoleId === 'role-teacher') {
      if (teacherAccountIncluded) {
        return []
      }
      teacherAccountIncluded = true
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

/** Pre-built dev login picker accounts for the webapp `/login` page. */
export const DEV_DEMO_LOGIN_ACCOUNTS = buildDevDemoLoginAccounts()
