import type { FixtureDataset } from '../datasets/types'
import type { DevAuthGuardianAccount, DevAuthStaffAccount } from './resolve-dev-seed-context'

function displayName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim()
}

export function syncStaffAuthDisplayNames(
  dataset: FixtureDataset,
  accounts: readonly DevAuthStaffAccount[],
): readonly DevAuthStaffAccount[] {
  const staffMembers = dataset.entities.staffMembers ?? []
  return accounts.map((account) => {
    const staff = staffMembers.find(entry => entry.id === account.staffId)
    if (!staff) {
      return account
    }
    return {
      ...account,
      name: displayName(staff.firstName, staff.lastName),
    }
  })
}

export function syncGuardianAuthDisplayNames(
  dataset: FixtureDataset,
  accounts: readonly DevAuthGuardianAccount[],
): readonly DevAuthGuardianAccount[] {
  const guardians = dataset.entities.guardians ?? []
  return accounts.map((account) => {
    const guardian = guardians.find(entry => entry.id === account.guardianId)
    if (!guardian) {
      return account
    }
    return {
      ...account,
      name: displayName(guardian.firstName, guardian.lastName),
    }
  })
}
