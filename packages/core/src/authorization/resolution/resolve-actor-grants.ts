import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EffectiveGrants } from '../model/effective-grants'
import { resolveGuardianGrants, resolveStudentGrants } from './resolve-portal-grants'
import { resolveEffectiveGrants } from './resolve-effective-grants'

export interface ResolveActorGrantsArgs {
  actorId: string
  actorType: 'staff' | 'guardian' | 'student'
  schoolId: string
  repositories: SchoolRepositories
  academicYearId?: string
  now?: Date
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
