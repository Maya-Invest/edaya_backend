import type { Context } from "hono";
import type { AppBindings } from "@/lib/http/types";

/**
 * Rebuilds the incoming request URL against {@link Environment.BETTER_AUTH_URL}.
 * Better Auth validates requests against `baseURL`; clients, proxies, and test
 * harnesses may use a different host/port than configured in env.
 */
export function toBetterAuthHandlerRequest(c: Context<AppBindings>): Request {
  const incoming = new URL(c.req.url);
  const base = new URL(c.env.BETTER_AUTH_URL);
  const url = new URL(`${incoming.pathname}${incoming.search}`, base);
  const init: RequestInit = {
    method: c.req.method,
    headers: c.req.raw.headers,
  };

  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    init.body = c.req.raw.body;
    (init as RequestInit & { duplex?: string }).duplex = "half";
  }

  return new Request(url.href, init);
}
