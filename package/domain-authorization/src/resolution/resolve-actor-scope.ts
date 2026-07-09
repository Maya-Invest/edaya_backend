import type { AuthorizationRepositories } from '@edaya/authorization'
import type { GuardianScope, StudentScope, TeacherActorScope } from '../model/actor-scope'
import type { InteractiveActorKind } from './interactive-actor-kind'
import { resolveGuardianScope, resolveStudentScope } from './resolve-portal-scopes'
import { resolveTeacherScope } from './resolve-teacher-scope'

export type ResolvedActorScope = GuardianScope | StudentScope | TeacherActorScope

export interface ResolveActorScopeArgs {
  actorKind: Exclude<InteractiveActorKind, 'staff'>
  actorId: string
  schoolId: string
  repositories: AuthorizationRepositories
  academicYearId?: string
}

export async function resolveActorScope(args: ResolveActorScopeArgs): Promise<ResolvedActorScope> {
  switch (args.actorKind) {
    case 'guardian':
      return resolveGuardianScope({
        guardianId: args.actorId,
        schoolId: args.schoolId,
        repositories: args.repositories,
      })
    case 'student':
      return resolveStudentScope({
        studentId: args.actorId,
        schoolId: args.schoolId,
        repositories: args.repositories,
      })
    case 'teacher':
      return resolveTeacherScope({
        teacherId: args.actorId,
        schoolId: args.schoolId,
        repositories: args.repositories,
        ...(args.academicYearId ? { academicYearId: args.academicYearId } : {}),
      })
  }
}
