import { StaffRole } from '../../domains'

export function systemAccessRoleId(schoolId: string, staffRole: StaffRole): string {
  return `access_role:${schoolId}:${staffRole}`
}

export const SYSTEM_ACCESS_ROLE_LABELS: Record<StaffRole, string> = {
  [StaffRole.Admin]: 'Administrateur',
  [StaffRole.Principal]: 'Chef d’établissement',
  [StaffRole.Teacher]: 'Enseignant',
  [StaffRole.Accountant]: 'Comptable',
  [StaffRole.Counselor]: 'Conseiller',
  [StaffRole.Coordinator]: 'Coordinateur',
  [StaffRole.Supervisor]: 'Surveillant',
}
