import type { Transport, TransportRequestOptions } from './runtime'
import { describe, expect, test } from 'bun:test'
import { createDocsClient } from './create-client'
import { createFetchTransport, DocsApiError } from './runtime'

describe('createDocsClient', () => {
  test('calls render over transport', async () => {
    const calls: Array<{ method: string, path: string, body?: unknown }> = []
    const transport: Transport = {
      async request<T>(method: string, path: string, options?: TransportRequestOptions) {
        calls.push({ method, path, body: options?.body })
        return {
          renderId: 'rnd_test',
          contentType: 'application/pdf',
          sha256: 'abc',
          bytesBase64: 'c3R1Yg==',
        } as T
      },
    }
    const client = createDocsClient(transport)

    const result = await client.render({
      templateKey: 'report-card.v1',
      format: 'pdf',
      locale: 'fr',
      schoolId: 'sch_demo',
      payload: { studentName: 'Ada', periodLabel: 'T1' },
      delivery: 'inline',
      idempotencyKey: 'k1',
    })

    expect(calls).toEqual([{
      method: 'POST',
      path: '/v1/render',
      body: {
        templateKey: 'report-card.v1',
        format: 'pdf',
        locale: 'fr',
        schoolId: 'sch_demo',
        payload: { studentName: 'Ada', periodLabel: 'T1' },
        delivery: 'inline',
        idempotencyKey: 'k1',
      },
    }])
    expect(result.renderId).toBe('rnd_test')
  })
})

describe('createFetchTransport', () => {
  test('maps error payloads to DocsApiError', async () => {
    const transport = createFetchTransport({
      baseUrl: 'https://docs.example',
      getAuthorization: () => 'token',
      fetch: (async () => new Response(JSON.stringify({
        code: 'document-rendering.forbidden',
        message: 'nope',
      }), { status: 403 })) as unknown as typeof fetch,
    })

    await expect(transport.request('GET', '/v1/templates')).rejects.toBeInstanceOf(DocsApiError)
  })
})
