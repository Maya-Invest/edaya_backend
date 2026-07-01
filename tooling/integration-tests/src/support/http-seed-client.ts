import type { Hono } from 'hono'
import type { AppBindings } from '@/http/types'
import { HttpSeedClient } from '@edaya/seeding/http'
import { apiPgliteEnv } from './api-pglite-env'

export function createHttpClientForApp(app: Hono<AppBindings>): HttpSeedClient {
  const apiOrigin = new URL(apiPgliteEnv.BETTER_AUTH_URL).origin

  return new HttpSeedClient({
    baseUrl: apiPgliteEnv.BETTER_AUTH_URL,
    fetch: async (input, init) => {
      const url = new URL(input.toString())
      if (url.origin !== apiOrigin) {
        return await fetch(input, init)
      }
      return await app.request(`${url.pathname}${url.search}`, init)
    },
  })
}
