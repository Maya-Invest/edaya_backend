export async function probeLocalApiReachable(baseUrl: string): Promise<boolean> {
  const normalized = baseUrl.replace(/\/+$/, '')

  try {
    const response = await fetch(`${normalized}/doc`, {
      signal: AbortSignal.timeout(2_000),
    })
    return response.status < 500
  }
  catch {
    return false
  }
}
