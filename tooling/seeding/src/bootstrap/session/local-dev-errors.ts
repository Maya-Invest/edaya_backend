export const LOCAL_DEV_WIPE_AND_RESEED_HINT
  = 'Stop bun repo dev, run `rm -rf .data`, start `bun repo dev`, then `bun repo ops seed` in a second terminal.'

export const STAGING_AUTH_CACHE_HINT
  = 'If identity sign-in succeeds but /core stays unauthorized, verify the issued JWT audience matches API_ORIGIN. '
    + 'School Hyperdrive may also be serving stale staff/school reads — '
    + 'temporarily disable caching on HYPERDRIVE or wait and retry. '
    + 'Then `bun repo ops seed clean staging --yes` and retry.'

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
