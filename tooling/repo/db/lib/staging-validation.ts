/** Validation may reset only a release-owned disposable loopback rehearsal. */
export function assertStagingMutationAllowed(value: string, env: Record<string, string | undefined>) {
  if (env['VALIDATE_ONLY'] !== 'true')
    return
  let local = false
  try {
    local = new URL(value).hostname === '127.0.0.1'
  }
  catch { /* Invalid targets must never authorize a write. */ }
  if (!local || env['EDAYA_DISPOSABLE_POSTGRES'] !== 'true')
    throw new Error('VALIDATE_ONLY forbids live database migration and reset')
}
