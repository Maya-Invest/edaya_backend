export interface TransportRequestOptions {
  readonly body?: unknown
  readonly headers?: Record<string, string>
}

export interface Transport {
  request: <T>(method: string, path: string, options?: TransportRequestOptions) => Promise<T>
}

export class DocsApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'DocsApiError'
    this.status = status
    this.code = code
  }
}

export function createFetchTransport(options: {
  readonly baseUrl: string
  readonly getAuthorization: () => string | Promise<string>
  readonly fetch?: typeof fetch
}): Transport {
  const fetchImpl = options.fetch ?? globalThis.fetch

  return {
    async request<T>(method: string, path: string, requestOptions?: TransportRequestOptions): Promise<T> {
      const authorization = await options.getAuthorization()
      const init: RequestInit = {
        method,
        headers: {
          Authorization: authorization.startsWith('Bearer ')
            ? authorization
            : `Bearer ${authorization}`,
          ...(requestOptions?.body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...requestOptions?.headers,
        },
      }
      if (requestOptions?.body !== undefined)
        init.body = JSON.stringify(requestOptions.body)

      const response = await fetchImpl(new URL(path, options.baseUrl), init)

      if (!response.ok) {
        let code = 'document-rendering.unavailable'
        let message = response.statusText
        try {
          const payload = await response.json() as { code?: string, message?: string }
          if (typeof payload.code === 'string')
            code = payload.code
          if (typeof payload.message === 'string')
            message = payload.message
        }
        catch {
          // keep defaults
        }
        throw new DocsApiError(response.status, code, message)
      }

      if (response.status === 204)
        return undefined as T

      return await response.json() as T
    },
  }
}
