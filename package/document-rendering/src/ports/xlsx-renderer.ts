export interface XlsxRenderInput {
  readonly templateKey: string
  readonly locale: string
  readonly payload: unknown
}

export interface XlsxRenderer {
  render: (input: XlsxRenderInput) => Promise<Uint8Array>
}
