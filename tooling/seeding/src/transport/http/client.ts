import { isStagingSeedApiUrl } from '../../support/resolve-seed-env'

export type HttpFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export interface HttpSeedClientOptions {
  baseUrl: string
  /** Central identity base URL for login, token exchange, and dev seed endpoints. */
  /** Trusted webapp origin for identity requests (Origin header). */
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
const IDENTITY_429_RETRIES = 2
const IDENTITY_429_MAX_WAIT_MS = 65_000
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

function retryAfterDelayMs(response: Response, fallbackMs: number): number {
  const header = response.headers.get('retry-after')
  if (!header) {
    return fallbackMs
  }
  const seconds = Number(header)
  if (!Number.isFinite(seconds) || seconds < 0) {
    return fallbackMs
  }
  return Math.min(seconds * 1000, IDENTITY_429_MAX_WAIT_MS)
}

export class HttpSeedClient {
  private readonly baseUrl: string
  private readonly authUrl: string
  private readonly appOrigin?: string
  private readonly fetchImpl: HttpFetch
  private readonly cookies = new Map<string, string>()
  private accessToken?: { value: string, expiresAt: number }
  private exchange?: Promise<string | undefined>
  private lastRequestAt = 0

  constructor(options: HttpSeedClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl)
    this.authUrl = normalizeBaseUrl(options.baseUrl)
    this.appOrigin = options.appOrigin?.replace(/\/+$/, '')
    this.fetchImpl = options.fetch ?? globalThis.fetch
  }

  get origin(): string {
    return this.baseUrl
  }

  get identityOrigin(): string {
    return this.authUrl
  }

  clearCookies(): void {
    this.cookies.clear()
    this.accessToken = undefined
    this.exchange = undefined
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
    // Preserve a usable token before nested account provisioning changes identity.
    // Otherwise each snapshot can restore an empty cache and exhaust the renewal quota.
    await this.getAccessToken()
    const snapshot = new Map(this.cookies)
    const accessToken = this.accessToken
    try {
      return await fn()
    }
    finally {
      this.cookies.clear()
      for (const [name, value] of snapshot) {
        this.cookies.set(name, value)
      }
      this.accessToken = accessToken
      this.exchange = undefined
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
        if (this.cookies.get(parsed.name) !== parsed.value)
          this.accessToken = undefined
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

  private async getAccessToken(): Promise<string | undefined> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 30000)
      return this.accessToken.value
    if (!this.cookieHeader())
      return undefined
    this.exchange ??= (async () => {
      const renewal = this.cookieHeader()
      const response = await this.request('/auth/edaya/access-token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resource: new URL(this.baseUrl).origin }),
      })
      if (response.status === 401)
        return undefined
      if (!response.ok)
        throw new Error(`Seed access-token exchange failed: HTTP ${response.status}`)
      const token = await response.json() as { accessToken: string, expiresAt: string }
      if (typeof token.accessToken !== 'string' || token.accessToken.length === 0
        || !Number.isFinite(Date.parse(token.expiresAt))) {
        throw new Error('Invalid seed access-token response')
      }
      if (renewal !== this.cookieHeader()) {
        return undefined
      }
      this.accessToken = { value: token.accessToken, expiresAt: Date.parse(token.expiresAt) }
      return token.accessToken
    })().finally(() => { this.exchange = undefined })
    return this.exchange
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const identityPath = normalizedPath.startsWith('/auth/')
      || normalizedPath === '/dev/seed/mark-email-verified'
    const url = path.startsWith('http')
      ? path
      : `${identityPath ? this.authUrl : this.baseUrl}${normalizedPath}`
    const headers = new Headers(init.headers)
    const cookieHeader = this.cookieHeader()
    const hasBearerAuth = headers.get('authorization')?.toLowerCase().startsWith('bearer ') ?? false
    // Presigned object-storage URLs (R2/S3) must not receive API session headers.
    if (identityPath) {
      if (cookieHeader && !headers.has('cookie') && !hasBearerAuth) {
        headers.set('cookie', cookieHeader)
      }
      if (!headers.has('origin')) {
        headers.set('origin', this.appOrigin ?? new URL(this.authUrl).origin)
      }
    }
    else if (this.isApiRequest(url)) {
      headers.delete('cookie')
      if (!headers.has('authorization')) {
        const accessToken = await this.getAccessToken()
        if (accessToken)
          headers.set('authorization', `Bearer ${accessToken}`)
      }
      if (!headers.has('origin')) {
        headers.set('origin', this.appOrigin ?? new URL(this.baseUrl).origin)
      }
    }

    const method = (init.method ?? 'GET').toUpperCase()
    const mayRetryGet = ['GET', 'HEAD'].includes(method)
    const maxRetries = mayRetryGet
      ? (this.isStaging()
          ? STAGING_REQUEST_RETRIES
          : DEFAULT_REQUEST_RETRIES)
      : (identityPath ? IDENTITY_429_RETRIES : 0)
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

      const retry429 = identityPath && response.status === 429
      if ((!RETRYABLE_STATUS_CODES.has(response.status) && !retry429) || attempt === maxRetries) {
        if (identityPath)
          this.absorbCookies(response)
        return response
      }
      if (!mayRetryGet && !retry429) {
        if (identityPath)
          this.absorbCookies(response)
        return response
      }

      lastResponse = response
      await sleep(retryAfterDelayMs(response, retryBaseDelayMs * (attempt + 1)))
    }

    if (identityPath)
      this.absorbCookies(lastResponse!)
    return lastResponse!
  }

  async jsonRequest<T = unknown>(path: string, init: RequestInit = {}): Promise<{ response: Response, body: T | null }> {
    const mayRetry = ['GET', 'HEAD'].includes((init.method ?? 'GET').toUpperCase())
    const outerRetries = mayRetry && this.isStaging() ? STAGING_JSON_OUTER_RETRIES : 0

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
