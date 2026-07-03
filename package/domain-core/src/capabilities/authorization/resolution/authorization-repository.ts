import type { EffectiveGrants } from '../model/effective-grants'

export interface AuthorizationRepository {
  resolveEffectiveGrants: (args: {
    staffMemberId: string
    schoolId: string
    academicYearId?: string
    now?: Date
    useStaffPermissionAssignments?: boolean
  }) => Promise<EffectiveGrants>
  resolveActorGrants: (args: {
    actorId: string
    actorType: 'staff' | 'guardian' | 'student'
    schoolId: string
    academicYearId?: string
    now?: Date
    useStaffPermissionAssignments?: boolean
  }) => Promise<EffectiveGrants>
}
