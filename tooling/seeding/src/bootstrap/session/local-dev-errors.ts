export const LOCAL_DEV_WIPE_AND_RESEED_HINT
  = 'Stop bun repo dev, run `rm -rf .data`, start `bun repo dev`, then `bun repo seed` in a second terminal.'

export const STAGING_AUTH_CACHE_HINT
  = 'If sign-up reports USER_ALREADY_EXISTS while sign-in fails after a wipe, Hyperdrive query cache is likely stale. '
    + 'Disable caching on the staging Hyperdrive (`wrangler hyperdrive update <id> --caching-disabled`) '
    + 'or bind HYPERDRIVE_AUTH to a cache-disabled config, then `bun repo seed clean --staging --yes` and retry.'

export function formatHttpBootstrapFailure(detail: string, options?: { staging?: boolean }): string {
  const hint = options?.staging
    ? STAGING_AUTH_CACHE_HINT
    : LOCAL_DEV_WIPE_AND_RESEED_HINT
  return (
    'HTTP /core bootstrap failed while the API is running. '
    + `${hint} `
    + `Detail: ${detail}`
  )
}

export function throwHttpBootstrapFailure(cause: unknown, options?: { staging?: boolean }): never {
  const detail = cause instanceof Error ? cause.message : String(cause)
  throw new Error(formatHttpBootstrapFailure(detail, options))
}
