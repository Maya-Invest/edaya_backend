import type { SchoolRepositories } from '../../../ports/repositories/school-repositories'
import type { EffectiveGrants } from '../model/effective-grants'
import { resolveEffectiveGrants } from './resolve-effective-grants'

export interface ResolveActorGrantsArgs {
  actorId: string
  actorType: 'staff' | 'guardian' | 'student'
  schoolId: string
  repositories: SchoolRepositories
  academicYearId?: string
  now?: Date
}

/** Staff-only grant resolution. Portal actors use `resolveActorScope`. */
export async function resolveActorGrants(args: ResolveActorGrantsArgs): Promise<EffectiveGrants> {
  if (args.actorType !== 'staff') {
    throw new Error(`resolveActorGrants is staff-only; use resolveActorScope for ${args.actorType}`)
  }

  return resolveEffectiveGrants({
    staffMemberId: args.actorId,
    schoolId: args.schoolId,
    repositories: args.repositories,
    academicYearId: args.academicYearId,
    now: args.now,
  })
}
