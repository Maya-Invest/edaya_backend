import type { Hono } from 'hono'
import type { AppBindings } from '@/http/types'
import { HttpSeedClient } from '@edaya/seeding/http'
import { apiPgliteEnv } from './api-pglite-env'

export function createHttpClientForApp(app: Hono<AppBindings>): HttpSeedClient {
  const apiOrigin = new URL(apiPgliteEnv.SCHOOL_API_ORIGIN).origin

  return new HttpSeedClient({
    baseUrl: apiPgliteEnv.SCHOOL_API_ORIGIN,
    authUrl: apiPgliteEnv.IDENTITY_ISSUER,
    fetch: async (input, init) => {
      const url = new URL(input.toString())
      if (url.origin !== apiOrigin) {
        return await fetch(input, init)
      }
      return await app.request(`${url.pathname}${url.search}`, init)
    },
  })
}
