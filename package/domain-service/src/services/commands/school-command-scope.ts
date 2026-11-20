import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { CommandReceiptScope } from '@edaya/core'
import { digestCommandRequest } from './command-execution'

/** Stable across token renewal, distinct across selected profiles and identity relinking. */
export async function schoolCommandScope(actor: SchoolScopedActorMetadata, command: string, logicalRequestId: string): Promise<CommandReceiptScope> {
  return {
    schoolId: actor.schoolId,
    command,
    callerId: await digestCommandRequest([actor.kind, actor.kind === 'system' ? actor.systemId : actor.actorId, actor.kind === 'system' ? actor.onBehalfOfSubjectId ?? null : 'subjectId' in actor ? actor.subjectId ?? null : null]),
    requestId: await digestCommandRequest(logicalRequestId),
  }
}
