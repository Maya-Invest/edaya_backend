import { createSystemActorMetadata } from './model/actor'

/** Called only by the platform registration command after session admission. */
export function createSchoolBootstrapActor(input: { schoolId: string, requestId: string, onBehalfOfSubjectId?: string }) {
  return createSystemActorMetadata({ ...input, systemId: 'school-bootstrap', reason: 'Register a school and its first owner profile' })
}
