import type { SchoolRepositories } from '../../../ports/repositories/school-repositories'
import type { EffectiveGrants } from '../model/effective-grants'
import { resolveEffectiveGrants } from './resolve-effective-grants'
import { resolveGuardianGrants, resolveStudentGrants } from './resolve-portal-grants'

export interface ResolveActorGrantsArgs {
  actorId: string
  actorType: 'staff' | 'guardian' | 'student'
  schoolId: string
  repositories: SchoolRepositories
  academicYearId?: string
  now?: Date
  useStaffPermissionAssignments?: boolean
}

export async function resolveActorGrants(args: ResolveActorGrantsArgs): Promise<EffectiveGrants> {
  switch (args.actorType) {
    case 'staff':
      return resolveEffectiveGrants({
        staffMemberId: args.actorId,
        schoolId: args.schoolId,
        repositories: args.repositories,
        academicYearId: args.academicYearId,
        now: args.now,
        useStaffPermissionAssignments: args.useStaffPermissionAssignments,
      })
    case 'guardian':
      return resolveGuardianGrants({
        guardianId: args.actorId,
        schoolId: args.schoolId,
        repositories: args.repositories,
      })
    case 'student':
      return resolveStudentGrants({
        studentId: args.actorId,
        schoolId: args.schoolId,
        repositories: args.repositories,
      })
  }
}
