import type { RenderDocumentRequest } from '@edaya/document-contracts'

export const INVALID_PAYLOAD_REQUEST: RenderDocumentRequest = {
  templateKey: 'report-card.v1',
  format: 'pdf',
  locale: 'fr',
  schoolId: 'sch_demo',
  payload: {},
  delivery: 'inline',
  idempotencyKey: 'demo/invalid',
}
