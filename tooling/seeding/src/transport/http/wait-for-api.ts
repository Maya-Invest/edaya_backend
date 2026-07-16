import { LOCAL_DEV_WIPE_AND_RESEED_HINT } from '../../bootstrap/session/local-dev-errors'

export interface WaitForApiOptions {
  timeoutMs?: number
  intervalMs?: number
  path?: string
}

function formatProbeFailure(path: string, status: number, body: string): string {
  if (status === 500 && /could not open file|pglite|disk i\/o error/i.test(body)) {
    return `${path} returned 500 (local PGlite is corrupted — stop bun repo dev, run \`rm -rf .data\`, restart, then \`bun repo seed\`)`
  }

  if (body.trim()) {
    const snippet = body.trim().slice(0, 160)
    return `${path} returned ${status}: ${snippet}`
  }

  return `${path} returned ${status}`
}

export async function waitForApi(
  baseUrl: string,
  options: WaitForApiOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 60_000
  const intervalMs = options.intervalMs ?? 500
  const paths = options.path ? [options.path] : ['/', '/reference', '/doc']
  const deadline = Date.now() + timeoutMs
  let lastDetail = 'no response'

  while (Date.now() < deadline) {
    for (const path of paths) {
      const target = new URL(path, baseUrl)
      try {
        const response = await fetch(target)
        if (response.ok) {
          return
        }
        const body = await response.text().catch(() => '')
        lastDetail = formatProbeFailure(path, response.status, body)
      }
      catch (error) {
        lastDetail = `${path} failed: ${error instanceof Error ? error.message : String(error)}`
      }
    }

    await Bun.sleep(intervalMs)
  }

  throw new Error(
    `API at ${baseUrl} did not become ready within ${timeoutMs}ms (last: ${lastDetail}). ${LOCAL_DEV_WIPE_AND_RESEED_HINT}`,
  )
}
