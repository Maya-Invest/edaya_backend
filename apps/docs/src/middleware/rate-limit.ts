export interface RateLimiter {
  limit: (options: { key: string }) => Promise<{ success: boolean }>
}

export async function enforceRateLimit(
  rateLimiter: RateLimiter | undefined,
  key: string,
): Promise<boolean> {
  if (!rateLimiter)
    return true
  const result = await rateLimiter.limit({ key })
  return result.success
}
