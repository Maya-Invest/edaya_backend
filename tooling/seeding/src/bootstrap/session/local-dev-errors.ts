export const LOCAL_DEV_WIPE_AND_RESEED_HINT
  = 'Stop bun dev, run `rm -rf .data`, start `bun dev`, then `bun seed` in a second terminal.'

export function formatHttpBootstrapFailure(detail: string): string {
  return (
    'HTTP /core bootstrap failed while the API is running. '
    + `${LOCAL_DEV_WIPE_AND_RESEED_HINT} `
    + `Detail: ${detail}`
  )
}

export function throwHttpBootstrapFailure(cause: unknown): never {
  const detail = cause instanceof Error ? cause.message : String(cause)
  throw new Error(formatHttpBootstrapFailure(detail))
}
