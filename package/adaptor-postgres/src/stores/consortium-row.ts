/**
 * Legacy consortium row shape retained for Postgres schema/store mapping only.
 * Domain/API consortium workflows have been removed; do not use outside adaptor-postgres.
 */
export interface ConsortiumSharedRules {
  structureTemplateIds: string[]
}

export interface ConsortiumRowInput {
  id: string
  name: string
  country?: string
  ownerSubjectId: string
  sharedRules?: ConsortiumSharedRules
  createdAt?: Date
}

export class ConsortiumRow {
  readonly id: string
  readonly name: string
  readonly country?: string
  readonly ownerSubjectId: string
  readonly sharedRules: ConsortiumSharedRules
  readonly createdAt: Date

  constructor(args: ConsortiumRowInput) {
    this.id = args.id
    this.name = args.name
    this.country = args.country
    this.ownerSubjectId = args.ownerSubjectId
    this.sharedRules = args.sharedRules ?? { structureTemplateIds: [] }
    this.createdAt = args.createdAt ?? new Date()
  }
}
