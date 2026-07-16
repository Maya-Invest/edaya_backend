import { isStagingSeedApiUrl } from '../../support/resolve-seed-env'

export type HttpFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export interface HttpSeedClientOptions {
  baseUrl: string
  /** Trusted webapp origin for Better Auth (Origin header). */
  appOrigin?: string
  fetch?: HttpFetch
}

const RETRYABLE_STATUS_CODES = new Set([
  429,
  502,
  503,
  504,
  520,
  521,
  522,
  523,
  524,
  525,
  526,
  527,
  530,
])
const DEFAULT_REQUEST_RETRIES = 5
const DEFAULT_RETRY_BASE_DELAY_MS = 500
const STAGING_REQUEST_RETRIES = 12
const STAGING_RETRY_BASE_DELAY_MS = 1500
/** Min gap between staging API calls — kept low; retries handle transient Worker limits. */
const STAGING_MIN_REQUEST_INTERVAL_MS = 5
const STAGING_JSON_OUTER_RETRIES = 50

export function isTransientHttpStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status)
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
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

function looksLikeHtml(text: string): boolean {
  const trimmed = text.trimStart()
  return trimmed.startsWith('<!DOCTYPE html')
    || trimmed.startsWith('<html')
    || trimmed.startsWith('<!doctype html')
}

export function summarizeHtmlError(text: string): string {
  const titleMatch = text.match(/<title>([^<]+)<\/title>/i)
  if (titleMatch?.[1]) {
    return titleMatch[1].replace(/\s+/g, ' ').trim()
  }

  const headlineMatch = text.match(/<h2[^>]*>([^<]+)<\/h2>/i)
  if (headlineMatch?.[1]) {
    return headlineMatch[1].replace(/\s+/g, ' ').trim()
  }

  return 'Non-JSON HTML error page'
}

function isWorkerLimitHtml(text: string): boolean {
  const summary = summarizeHtmlError(text).toLowerCase()
  return summary.includes('worker exceeded resource limits')
    || summary.includes('error 1102')
}

function formatHttpFailure(path: string, status: number, detail: string): string {
  return `HTTP ${status} ${detail} (${path})`
}

export class HttpSeedClient {
  private readonly baseUrl: string
  private readonly appOrigin?: string
  private readonly fetchImpl: HttpFetch
  private readonly cookies = new Map<string, string>()
  private lastRequestAt = 0

  constructor(options: HttpSeedClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl)
    this.appOrigin = options.appOrigin?.replace(/\/+$/, '')
    this.fetchImpl = options.fetch ?? globalThis.fetch
  }

  get origin(): string {
    return this.baseUrl
  }

  clearCookies(): void {
    this.cookies.clear()
  }

  private isStaging(): boolean {
    return isStagingSeedApiUrl(this.baseUrl)
  }

  cookieHeader(): string | undefined {
    if (this.cookies.size === 0) {
      return undefined
    }

    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
  }

  /** Run a callback while temporarily isolating auth cookie mutations. */
  async withCookieSnapshot<T>(fn: () => Promise<T>): Promise<T> {
    const snapshot = new Map(this.cookies)
    try {
      return await fn()
    }
    finally {
      this.cookies.clear()
      for (const [name, value] of snapshot) {
        this.cookies.set(name, value)
      }
    }
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

  private async paceStagingRequest(): Promise<void> {
    if (!this.isStaging()) {
      return
    }

    const elapsed = Date.now() - this.lastRequestAt
    if (elapsed < STAGING_MIN_REQUEST_INTERVAL_MS) {
      await sleep(STAGING_MIN_REQUEST_INTERVAL_MS - elapsed)
    }
    this.lastRequestAt = Date.now()
  }

  private isApiRequest(url: string): boolean {
    try {
      return new URL(url).origin === new URL(this.baseUrl).origin
    }
    catch {
      return false
    }
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const headers = new Headers(init.headers)
    const cookieHeader = this.cookieHeader()
    const hasBearerAuth = headers.get('authorization')?.toLowerCase().startsWith('bearer ') ?? false
    // Presigned object-storage URLs (R2/S3) must not receive API session headers.
    if (this.isApiRequest(url)) {
      if (cookieHeader && !headers.has('cookie') && !hasBearerAuth) {
        headers.set('cookie', cookieHeader)
      }
      if (this.appOrigin && !headers.has('origin')) {
        headers.set('origin', this.appOrigin)
      }
    }

    const maxRetries = this.isStaging()
      ? STAGING_REQUEST_RETRIES
      : DEFAULT_REQUEST_RETRIES
    const retryBaseDelayMs = this.isStaging()
      ? STAGING_RETRY_BASE_DELAY_MS
      : DEFAULT_RETRY_BASE_DELAY_MS

    let lastResponse: Response | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (this.isApiRequest(url)) {
        await this.paceStagingRequest()
      }

      const response = await this.fetchImpl(url, {
        ...init,
        headers,
      })

      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === maxRetries) {
        this.absorbCookies(response)
        return response
      }

      lastResponse = response
      await sleep(retryBaseDelayMs * (attempt + 1))
    }

    this.absorbCookies(lastResponse!)
    return lastResponse!
  }

  async jsonRequest<T = unknown>(path: string, init: RequestInit = {}): Promise<{ response: Response, body: T | null }> {
    const outerRetries = this.isStaging() ? STAGING_JSON_OUTER_RETRIES : 0

    for (let outer = 0; outer <= outerRetries; outer++) {
      const response = await this.request(path, init)
      const text = await response.text()

      if (!text.trim()) {
        return { response, body: null }
      }

      if (looksLikeHtml(text)) {
        const summary = summarizeHtmlError(text)
        const retryable = isTransientHttpStatus(response.status) || isWorkerLimitHtml(text)
        if (retryable && outer < outerRetries) {
          await sleep(STAGING_RETRY_BASE_DELAY_MS * (outer + 2))
          continue
        }

        throw new Error(formatHttpFailure(path, response.status, summary))
      }

      try {
        return {
          response,
          body: JSON.parse(text) as T,
        }
      }
      catch {
        if (outer < outerRetries) {
          await sleep(STAGING_RETRY_BASE_DELAY_MS * (outer + 2))
          continue
        }

        throw new Error(formatHttpFailure(
          path,
          response.status,
          `invalid JSON response: ${text.slice(0, 160)}`,
        ))
      }
    }

    throw new Error(`HTTP request failed for ${path}`)
  }
}
