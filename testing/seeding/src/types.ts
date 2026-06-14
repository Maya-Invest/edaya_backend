import type { ActorMetadata, SchoolRepositories, SchoolService } from '@edaya/core'

export interface SeedApplication {
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
