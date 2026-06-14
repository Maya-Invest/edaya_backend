export interface WaitForApiOptions {
  timeoutMs?: number
  intervalMs?: number
  path?: string
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
        lastDetail = `${path} returned ${response.status}`
      }
      catch (error) {
        lastDetail = `${path} failed: ${error instanceof Error ? error.message : String(error)}`
      }
    }

    await Bun.sleep(intervalMs)
  }

  throw new Error(
    `API at ${baseUrl} did not become ready within ${timeoutMs}ms (last: ${lastDetail})`,
  )
}
