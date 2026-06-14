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
  const path = options.path ?? '/reference'
  const target = new URL(path, baseUrl)
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(target)
      if (response.ok) {
        return
      }
    }
    catch {
      // API not ready yet.
    }

    await Bun.sleep(intervalMs)
  }

  throw new Error(`API at ${baseUrl} did not become ready within ${timeoutMs}ms`)
}
