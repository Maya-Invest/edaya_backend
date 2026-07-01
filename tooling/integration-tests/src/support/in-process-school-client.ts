import type { Env, Hono } from 'hono'
import type { Transport } from '../generated/api-client'
import { ApiError, createSchoolClient } from '../generated/api-client'

export function createInProcessTransport<E extends Env>(
  app: Hono<E>,
  options: { headers?: Record<string, string> | (() => Record<string, string>) } = {},
): Transport {
  return {
    async request<T>(method: string, path: string, requestOptions?: { body?: unknown }): Promise<T> {
      const headers = {
        'content-type': 'application/json',
        ...(typeof options.headers === 'function' ? options.headers() : options.headers),
      }

      const response = await app.request(path, {
        method,
        headers,
        body: requestOptions?.body !== undefined ? JSON.stringify(requestOptions.body) : undefined,
      })

      if (!response.ok) {
        throw new ApiError(response.status, await response.json().catch(() => response.text()))
      }

      const text = await response.text()
      return (text ? JSON.parse(text) : null) as T
    },
  }
}

export function createInProcessSchoolClient<E extends Env>(
  app: Hono<E>,
  options: { headers?: Record<string, string> | (() => Record<string, string>) } = {},
) {
  return createSchoolClient<Record<string, unknown>>(createInProcessTransport(app, options))
}
