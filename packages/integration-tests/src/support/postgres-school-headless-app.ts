import type {
  ActorMetadata,
} from '@edaya/core'
import {
  applyAllSaveFailureWraps,
  buildSchoolApplication,
  buildTestRepositoriesMap,
  createDefaultTestActor,
  createSaveFailureController,
  seedDefaultStaffMember,
} from '../utils/test-adapter'

export function createPostgresAppBuilder(db: any, repos: any, AtomicExecutionCtor: any) {
  return (actor?: ActorMetadata) => {
    const { failSaveOnAttempt, getSaveFailure, clearSaveFailure } = createSaveFailureController()

    applyAllSaveFailureWraps(repos, getSaveFailure, clearSaveFailure)

    const defaultActor = createDefaultTestActor(actor)

    const application = buildSchoolApplication({
      atomicExecution: new AtomicExecutionCtor(db),
      repositories: repos,
      actor: defaultActor,
    })

    seedDefaultStaffMember(repos, defaultActor)

    return {
      app: application.forActor(defaultActor),
      repositories: buildTestRepositoriesMap(repos),
      schoolRepositories: repos,
      forActor: (boundActor: ActorMetadata) => application.forActor(boundActor),
      failSaveOnAttempt,
    }
  }
}
