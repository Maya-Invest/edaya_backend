import type { ActorMetadata } from '@edaya/authorization'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { SchoolService } from '../../services/school-service'

/** Public onboarding surface of `SchoolApplication` / `ApiSchoolApplication`. */
export interface OnboardingSchoolApplication {
  readonly repositories: SchoolRepositories
  forActor: (actor: ActorMetadata) => SchoolService
}
