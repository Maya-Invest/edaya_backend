/**
 * Rebuilds the incoming request URL against {@link Environment.BETTER_AUTH_URL}.
 * Identity uses a canonical origin; clients, proxies, and test
 * harnesses may use a different host/port than configured in env.
 */
export function toIdentityRequest(c: {
  env: {
    BETTER_AUTH_URL: string;
  };
  req: {
    url: string;
    method: string;
    raw: Request;
  };
}): Request {
  const incoming = new URL(c.req.url);
  const base = new URL(c.env.BETTER_AUTH_URL);
  const url = new URL(`${incoming.pathname}${incoming.search}`, base);
  const init: RequestInit = {
    method: c.req.method,
    headers: c.req.raw.headers,
  };
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    init.body = c.req.raw.body;
    (init as RequestInit & {
      duplex?: string;
    }).duplex = "half";
  }
  return new Request(url.href, init);
}
