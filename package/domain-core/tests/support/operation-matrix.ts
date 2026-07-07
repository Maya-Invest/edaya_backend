import type { ActorMetadata } from '../../src/capabilities/authorization'
import type { OperationContext, OperationRef } from '../../src/capabilities/authorization/operations/types'
import { describe, expect, test } from 'bun:test'
import { AuthorizationError } from '../../src/capabilities/authorization'
import { operationModule } from '../../src/capabilities/authorization/gates/operation-module'

export interface OperationMatrixRow {
  readonly label?: string
  readonly actor: () => ActorMetadata
  readonly expect: 'allow' | 'deny'
  readonly context?: OperationContext
}

export function describeOperationMatrix(
  operation: OperationRef,
  rows: readonly OperationMatrixRow[],
): void {
  describe(`operation matrix: ${operation.id}`, () => {
    for (const [index, row] of rows.entries()) {
      const title = row.label ?? `row ${index + 1}`
      test(title, () => {
        const run = operationModule(operation, row.context)
        if (row.expect === 'allow') {
          expect(() => run(row.actor())).not.toThrow()
          return
        }
        expect(() => run(row.actor())).toThrow(AuthorizationError)
      })
    }
  })
}
