export type StaffProfileRole
  = | 'directeur'
    | 'deputy_director'
    | 'studies_director'
    | 'educateur'
    | 'cpe'
    | 'secretary'
    | 'accountant'
    | 'it_admin'

export const STAFF_PROFILE_ROLES = [
  'directeur',
  'deputy_director',
  'studies_director',
  'educateur',
  'cpe',
  'secretary',
  'accountant',
  'it_admin',
] as const satisfies readonly StaffProfileRole[]

export function isStaffProfileRole(value: string): value is StaffProfileRole {
  return (STAFF_PROFILE_ROLES as readonly string[]).includes(value)
}
