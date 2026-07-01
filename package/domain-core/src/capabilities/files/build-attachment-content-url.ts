export const ATTACHMENT_CONTENT_ROUTE_PREFIX = '/core/files'

export function buildAttachmentContentUrl(apiBaseUrl: string, attachmentId: string): string {
  const base = apiBaseUrl.replace(/\/+$/, '')
  return `${base}${ATTACHMENT_CONTENT_ROUTE_PREFIX}/${attachmentId}/content`
}
