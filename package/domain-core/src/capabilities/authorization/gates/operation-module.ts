import type { EntityWriteAuthorization } from '../../../application/entities/managed-entity-service'
import type { SchoolRepositories } from '../../../ports'
import type { ActorMetadata } from '../model/actor'
import type { OperationContext, OperationRef } from '../operations/types'
import { assertOperation } from '../operations/assert-operation'

export type OperationRefResolver<T> = OperationRef | ((
  entity: T,
  existing: T | undefined,
) => OperationRef)

function resolveOperationRef<T>(
  operation: OperationRefResolver<T>,
  entity: T,
  existing: T | undefined,
): OperationRef {
  return typeof operation === 'function' ? operation(entity, existing) : operation
}

export type OperationContextResolver = OperationContext | ((
  actor: ActorMetadata,
) => OperationContext | Promise<OperationContext>)

export function operationModule(
  operation: OperationRef,
  context?: OperationContextResolver,
): (actor: ActorMetadata) => void | Promise<void> {
  return (actor): void | Promise<void> => {
    const run = (resolved?: OperationContext) => {
      assertOperation(actor, operation, resolved, 'module')
    }

    if (!context) {
      run()
      return
    }

    if (typeof context === 'function') {
      return Promise.resolve(context(actor)).then(run)
    }

    run(context)
  }
}

export function anyOperationModule(
  operations: readonly OperationRef[],
  context?: OperationContextResolver,
): (actor: ActorMetadata) => void | Promise<void> {
  if (operations.length === 0) {
    throw new Error('anyOperationModule requires at least one operation')
  }

  return async (actor) => {
    let lastError: unknown
    for (const operation of operations) {
      try {
        await Promise.resolve(operationModule(operation, context)(actor))
        return
      }
      catch (error) {
        lastError = error
      }
    }
    throw lastError
  }
}

export type OperationEntityContextResolver<T> = (
  entity: T,
  existing: T | undefined,
  repositories: SchoolRepositories,
) => OperationContext | Promise<OperationContext>

export function authorizeSaveWithOperation<T>(
  operation: OperationRefResolver<T>,
  resolveContext: OperationEntityContextResolver<T>,
  authorizeSave: EntityWriteAuthorization<T>['authorizeSave'],
): EntityWriteAuthorization<T>['authorizeSave'] {
  return async (actor, entity, existing, repositories) => {
    const context = await resolveContext(entity, existing, repositories)
    assertOperation(actor, resolveOperationRef(operation, entity, existing), context, 'full')
    await authorizeSave(actor, entity, existing, repositories)
  }
}

export function authorizeDeleteWithOperation<T>(
  operation: OperationRef,
  resolveContext: (entity: T, repositories: SchoolRepositories) => OperationContext | Promise<OperationContext>,
  authorizeDelete: EntityWriteAuthorization<T>['authorizeDelete'],
): EntityWriteAuthorization<T>['authorizeDelete'] {
  return async (actor, entity, repositories) => {
    const context = await resolveContext(entity, repositories)
    assertOperation(actor, operation, context, 'full')
    await authorizeDelete(actor, entity, repositories)
  }
}
