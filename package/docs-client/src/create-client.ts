import type { Transport } from './runtime'
import type { components } from './schema'

export type HealthResponse = components['schemas']['HealthResponse']
export type RenderDocumentRequest = components['schemas']['RenderDocumentRequest']
export type RenderDocumentResponse = components['schemas']['RenderDocumentResponse']
export type TemplateCatalogResponse = components['schemas']['TemplateCatalogResponse']

export interface DocsClient {
  health: () => Promise<HealthResponse>
  listTemplates: () => Promise<TemplateCatalogResponse>
  render: (body: RenderDocumentRequest) => Promise<RenderDocumentResponse>
}

export function createDocsClient(transport: Transport): DocsClient {
  return {
    health: () => transport.request<HealthResponse>('GET', '/health'),
    listTemplates: () => transport.request<TemplateCatalogResponse>('GET', '/v1/templates'),
    render: body => transport.request<RenderDocumentResponse>('POST', '/v1/render', { body }),
  }
}
