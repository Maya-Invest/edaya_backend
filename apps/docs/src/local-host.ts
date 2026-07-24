import { createDocsApp } from './composition.ts'
import { readLocalHostConfig } from './config/env.ts'

const { port, devToken, jwtSecret, gotenbergUrl, r2 } = readLocalHostConfig()

const app = createDocsApp({
  auth: {
    ...(devToken ? { devToken } : {}),
    ...(jwtSecret ? { jwtSecret } : {}),
  },
  ...(gotenbergUrl ? { gotenbergUrl } : {}),
  r2,
})

console.log(`edaya docs listening on http://localhost:${port}`)

Bun.serve({
  port,
  fetch: app.fetch,
})
