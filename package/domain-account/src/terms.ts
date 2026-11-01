export type TermsLocale = 'fr' | 'en'
export interface TermsAcceptanceInput { version: string, locale: TermsLocale, accepted: true }
/** Server-owned evidence pinned to the document shown at the start of a login. */
export interface AcceptedTerms { version: string, locale: TermsLocale, documentHash: string }
export interface TermsAcceptance extends AcceptedTerms { accountId: string, acceptedAt: number }
export interface TermsDocument extends AcceptedTerms {
  title: string
  status: 'draft' | 'published'
  sections: { heading: string, paragraphs: string[] }[]
  sourceUrl?: string
  /** Sanitized legal-content fragment, pinned to documentHash. */
  html?: string
}
export interface TermsResponse { enforced: boolean, document: TermsDocument | null }
export interface TermsPolicyPort { current: (locale: TermsLocale) => TermsResponse | Promise<TermsResponse> }
