import type { ActorMetadata } from '@edaya/authorization'
import type { dispatchGradingRecalculation, SchoolRepositories, SchoolService } from '@edaya/service'

export interface SeedApplication {
  durableWork: Parameters<typeof dispatchGradingRecalculation>[0]['durableWork']
  repositories: SchoolRepositories
  forActor: (actor: ActorMetadata) => SchoolService
}

export interface AuthAccountInput {
  email: string
  password: string
  name: string
}

export interface EnsureUserOptions {
  /** Keep the current HTTP session cookies (director bootstrap) after resolving subjectId. */
  preserveSession?: boolean
}

export interface AuthProvisioner {
  ensureUser: (account: AuthAccountInput, options?: EnsureUserOptions) => Promise<{ subjectId: string }>
  lookupSubjectIdByEmail: (email: string, password: string) => Promise<string | undefined>
}
