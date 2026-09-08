import type { DocumentRendererPort } from '../ports/gateways/document-renderer'

export const noOpDocumentRenderer: DocumentRendererPort = {
  render: async () => {
    throw new Error('Document rendering is disabled on this runtime')
  },
}
