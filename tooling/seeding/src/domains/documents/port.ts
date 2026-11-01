import type { DocumentTemplateKey } from '@edaya/core'
import type { FixtureDocumentIssuance } from '@edaya/fixtures'

export interface DocumentIssuanceSeedRecord extends FixtureDocumentIssuance {
  templateKey: DocumentTemplateKey
}

export interface DocumentsSeedPort {
  requestIssuance: (record: DocumentIssuanceSeedRecord) => Promise<void>
  saveFailedIssuance: (record: DocumentIssuanceSeedRecord) => Promise<void>
  dispatchRender: () => Promise<void>
}
