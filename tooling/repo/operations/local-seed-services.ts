import { setTimeout as delay } from 'node:timers/promises'

/** Wait for both owned services before the seed preflight can decide to skip photos. */
export async function waitForLocalSeedServices(options: {
  apiUrl: string
  filesUrl: string
  appOrigin: string
  assertRunning: () => void
  timeoutMs?: number
}) {
  const deadline = Date.now() + (options.timeoutMs ?? 60000)
  do {
    options.assertRunning()
    try {
      const [api, files] = await Promise.all([
        fetch(new URL('/auth/edaya/testing/capabilities', options.apiUrl), { headers: { origin: options.appOrigin }, signal: AbortSignal.timeout(2000) }),
        fetch(new URL('/health', options.filesUrl), { signal: AbortSignal.timeout(2000) }),
      ])
      if (api.ok && files.ok && (await api.json() as { otpAccess?: boolean }).otpAccess)
        return
    }
    catch { /* Startup is bounded; service exits fail immediately on the next check. */ }
    await delay(100)
  } while (Date.now() < deadline)
  throw new Error('Local reset services did not become ready; see .ci-evidence/local-seed-services.json')
}
