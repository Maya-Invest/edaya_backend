import type { ActorMetadata } from '../../src/capabilities/authorization'
import type { OperationContext, OperationRef } from '../../src/capabilities/authorization/operations/types'
import { describe, expect, test } from 'bun:test'
import { AuthorizationError } from '../../src/capabilities/authorization'
import { operationModule } from '../../src/capabilities/authorization/gates/operation-module'

const operationMatrixCoverage = (
  globalThis as typeof globalThis & { __operationMatrixCoverage?: Set<string> }
).__operationMatrixCoverage ??= new Set<string>()

export function getOperationMatrixCoverage(): ReadonlySet<string> {
  return operationMatrixCoverage
}

export function resetOperationMatrixCoverageForTests(): void {
  operationMatrixCoverage.clear()
}

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
  operationMatrixCoverage.add(operation.id)

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
