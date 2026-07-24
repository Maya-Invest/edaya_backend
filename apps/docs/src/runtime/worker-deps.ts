import type { BrowserRunBinding, R2Environment } from '@edaya/document-rendering'
import type { DocsAuthConfig } from '../auth/service-token.ts'
import type { CreateDocsAppOptions } from '../composition.ts'
import type { RateLimiter } from '../middleware/rate-limit.ts'

export interface DocsWorkerEnv {
  readonly DOCS_JWT_SECRET?: string
  readonly DOCS_DEV_TOKEN?: string
  readonly R2_ACCESS_KEY_ID?: string
  readonly R2_SECRET_ACCESS_KEY?: string
  readonly R2_BUCKET_NAME?: string
  readonly R2_ACCOUNT_ID?: string
  readonly R2_ENDPOINT?: string
  readonly BROWSER?: BrowserRunBinding
  readonly DOCS_RATE_LIMITER?: RateLimiter
}

export function resolveWorkerDeps(env: DocsWorkerEnv): CreateDocsAppOptions {
  const auth: DocsAuthConfig = {
    ...(env.DOCS_DEV_TOKEN ? { devToken: env.DOCS_DEV_TOKEN } : {}),
    ...(env.DOCS_JWT_SECRET ? { jwtSecret: env.DOCS_JWT_SECRET } : {}),
  }

  const r2: R2Environment = {
    ...(env.R2_ACCESS_KEY_ID === undefined ? {} : { R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID }),
    ...(env.R2_SECRET_ACCESS_KEY === undefined ? {} : { R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY }),
    ...(env.R2_BUCKET_NAME === undefined ? {} : { R2_BUCKET_NAME: env.R2_BUCKET_NAME }),
    ...(env.R2_ACCOUNT_ID === undefined ? {} : { R2_ACCOUNT_ID: env.R2_ACCOUNT_ID }),
    ...(env.R2_ENDPOINT === undefined ? {} : { R2_ENDPOINT: env.R2_ENDPOINT }),
  }

  return {
    auth,
    r2,
    ...(env.BROWSER === undefined ? {} : { browser: env.BROWSER }),
    ...(env.DOCS_RATE_LIMITER === undefined ? {} : { rateLimiter: env.DOCS_RATE_LIMITER }),
  }
}
