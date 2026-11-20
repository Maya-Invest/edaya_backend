import type { Allocation, StudentAccountEntry } from '@edaya/core'
import type { StoreDatabase } from '../postgres-store'
import {
  AccountEntryDirection,
  AccountEntrySourceKind,
  Allocation as AllocationCtor,
  AllocationKind,
  StudentAccountEntry as StudentAccountEntryCtor,
} from '@edaya/core'
import { customStore } from '../lib/store-factory'
import * as schema from '../postgres-schema'
import { enumValue } from './entity-store-helpers'

export function createFinanceLedgerStores(db: StoreDatabase) {
  return {
    allocations: customStore(
      db,
      schema.allocations,
      (entity: Allocation) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        accountId: entity.accountId,
        chargeId: entity.chargeId,
        amount: entity.amount.amount,
        currency: entity.amount.currency,
        kind: entity.kind,
        causedByPaymentId: entity.causedByPaymentId ?? null,
        reversesAllocationId: entity.reversesAllocationId ?? null,
        effectiveAt: entity.effectiveAt,
        recordedAt: entity.recordedAt,
        createdAt: entity.createdAt,
      }),
      row => new AllocationCtor({
        id: row.id,
        schoolId: row.schoolId,
        accountId: row.accountId,
        chargeId: row.chargeId,
        amount: row.amount,
        currency: row.currency,
        kind: enumValue(AllocationKind, row.kind, 'allocations.kind'),
        causedByPaymentId: row.causedByPaymentId,
        reversesAllocationId: row.reversesAllocationId,
        effectiveAt: row.effectiveAt,
        recordedAt: row.recordedAt,
        createdAt: row.createdAt,
      }),
    ),
    studentAccountEntries: customStore(
      db,
      schema.studentAccountEntries,
      (entity: StudentAccountEntry) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        accountId: entity.accountId,
        direction: entity.direction,
        amount: entity.amount.amount,
        currency: entity.amount.currency,
        sourceKind: entity.sourceKind,
        sourceId: entity.sourceId,
        commandId: entity.commandId ?? null,
        effectiveAt: entity.effectiveAt,
        recordedAt: entity.recordedAt,
        resultingAvailableBalance: entity.resultingAvailableBalance.amount,
        createdAt: entity.createdAt,
      }),
      row => new StudentAccountEntryCtor({
        id: row.id,
        schoolId: row.schoolId,
        accountId: row.accountId,
        direction: enumValue(AccountEntryDirection, row.direction, 'studentAccountEntries.direction'),
        amount: row.amount,
        currency: row.currency,
        sourceKind: enumValue(AccountEntrySourceKind, row.sourceKind, 'studentAccountEntries.sourceKind'),
        sourceId: row.sourceId,
        commandId: row.commandId,
        effectiveAt: row.effectiveAt,
        recordedAt: row.recordedAt,
        resultingAvailableBalance: row.resultingAvailableBalance,
        createdAt: row.createdAt,
      }),
    ),
  }
}
