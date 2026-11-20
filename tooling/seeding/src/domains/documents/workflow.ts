import type { FixtureDataset } from '@edaya/fixtures'
import type { DocumentIssuanceSeedRecord, DocumentsSeedPort } from './port'
import { isDocumentTemplateKey } from '@edaya/core'

export interface DevDocumentsSeedCounts {
  documentIssuances: number
}

export async function seedDevDocuments(
  port: DocumentsSeedPort,
  dataset: FixtureDataset,
): Promise<DevDocumentsSeedCounts> {
  const records = (dataset.extensions?.documentIssuances ?? []).flatMap((record): DocumentIssuanceSeedRecord[] => {
    if (!isDocumentTemplateKey(record.templateKey))
      return []
    return [{ ...record, templateKey: record.templateKey }]
  })
  for (const record of records) {
    if (record.status === 'failed')
      await port.saveFailedIssuance(record)
    else
      await port.requestIssuance(record)
  }
  await port.dispatchRender()
  return { documentIssuances: records.length }
}
