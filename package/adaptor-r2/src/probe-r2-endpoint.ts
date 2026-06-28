const DEFAULT_PROBE_TIMEOUT_MS = 5_000;

/**
 * Returns true when the R2 S3 endpoint completes a TLS handshake.
 * Any HTTP response (including 403/404) counts as reachable; connection/TLS errors do not.
 */
export async function probeR2EndpointReachable(
  endpoint: string,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  const normalizedEndpoint = endpoint.replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(normalizedEndpoint, {
      method: "HEAD",
      signal: controller.signal,
    });
    return true;
  }
  catch {
    return false;
  }
  finally {
    clearTimeout(timer);
  }
}
