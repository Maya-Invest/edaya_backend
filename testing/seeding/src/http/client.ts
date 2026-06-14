export type HttpFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export interface HttpSeedClientOptions {
  baseUrl: string
  fetch?: HttpFetch
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function parseSetCookie(setCookie: string): { name: string, value: string } | null {
  const [pair] = setCookie.split(';')
  if (!pair) {
    return null
  }

  const separatorIndex = pair.indexOf('=')
  if (separatorIndex <= 0) {
    return null
  }

  return {
    name: pair.slice(0, separatorIndex).trim(),
    value: pair.slice(separatorIndex + 1).trim(),
  }
}

export class HttpSeedClient {
  private readonly baseUrl: string
  private readonly fetchImpl: HttpFetch
  private readonly cookies = new Map<string, string>()

  constructor(options: HttpSeedClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl)
    this.fetchImpl = options.fetch ?? globalThis.fetch
  }

  get origin(): string {
    return this.baseUrl
  }

  cookieHeader(): string | undefined {
    if (this.cookies.size === 0) {
      return undefined
    }

    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
  }

  absorbCookies(response: Response): void {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] }
    const setCookies = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : (() => {
          const single = response.headers.get('set-cookie')
          return single ? [single] : []
        })()

    for (const setCookie of setCookies) {
      const parsed = parseSetCookie(setCookie)
      if (parsed) {
        this.cookies.set(parsed.name, parsed.value)
      }
    }
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const headers = new Headers(init.headers)
    const cookieHeader = this.cookieHeader()
    if (cookieHeader && !headers.has('cookie')) {
      headers.set('cookie', cookieHeader)
    }

    const response = await this.fetchImpl(url, {
      ...init,
      headers,
    })
    this.absorbCookies(response)
    return response
  }

  async jsonRequest<T = unknown>(path: string, init: RequestInit = {}): Promise<{ response: Response, body: T | null }> {
    const response = await this.request(path, init)
    const text = await response.text()
    if (!text.trim()) {
      return { response, body: null }
    }

    return {
      response,
      body: JSON.parse(text) as T,
    }
  }
}
