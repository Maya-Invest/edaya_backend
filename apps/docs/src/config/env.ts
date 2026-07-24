import type { R2Environment } from '@edaya/document-rendering'

interface DocsProcessEnv {
  DOCS_PORT?: string
  DOCS_DEV_TOKEN?: string
  DOCS_JWT_SECRET?: string
  GOTENBERG_URL?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  R2_BUCKET_NAME?: string
  R2_ACCOUNT_ID?: string
  R2_ENDPOINT?: string
}

const env = Bun.env as DocsProcessEnv

export function readLocalHostConfig() {
  const r2: R2Environment = {
    ...(env.R2_ACCESS_KEY_ID === undefined ? {} : { R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID }),
    ...(env.R2_SECRET_ACCESS_KEY === undefined ? {} : { R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY }),
    ...(env.R2_BUCKET_NAME === undefined ? {} : { R2_BUCKET_NAME: env.R2_BUCKET_NAME }),
    ...(env.R2_ACCOUNT_ID === undefined ? {} : { R2_ACCOUNT_ID: env.R2_ACCOUNT_ID }),
    ...(env.R2_ENDPOINT === undefined ? {} : { R2_ENDPOINT: env.R2_ENDPOINT }),
  }

  return {
    port: Number(env.DOCS_PORT ?? 3090),
    devToken: env.DOCS_DEV_TOKEN,
    jwtSecret: env.DOCS_JWT_SECRET,
    gotenbergUrl: env.GOTENBERG_URL,
    r2,
  }
}
