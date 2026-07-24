export interface RenderLogFields {
  readonly event: 'docs.render'
  readonly templateKey: string
  readonly format: string
  readonly schoolId: string
  readonly delivery: string
  readonly status: 'success' | 'failure'
  readonly durationMs: number
  readonly renderId?: string
  readonly byteSize?: number
  readonly errorCode?: string
}

/** Structured render log — never include payloads, tokens, or artifact bytes. */
export function logRenderEvent(fields: RenderLogFields): void {
  console.log(JSON.stringify(fields))
}
