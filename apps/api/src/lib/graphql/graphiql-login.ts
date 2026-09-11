import { z } from "zod";
import type { Context } from "hono";
import type { AppBindings } from "@/http/types";
import { isGraphiQLEnabled } from "@/lib/graphql/graphiql";

const graphiqlLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function collectSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

export async function handleGraphiQLLogin(c: Context<AppBindings>) {
  if (!isGraphiQLEnabled(c.env?.NODE_ENV)) {
    return c.json({ message: "GraphiQL login is disabled" }, 404);
  }

  let payload: z.infer<typeof graphiqlLoginSchema>;
  try {
    payload = graphiqlLoginSchema.parse(await c.req.json());
  }
  catch {
    return c.json({ message: "Invalid email or password payload" }, 400);
  }

  const baseUrl = c.env?.IDENTITY_ISSUER ?? "http://localhost:9900";
  const identityOrigin = new URL(baseUrl).origin;
  const response = await fetch(new URL("/auth/sign-in/email", baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "origin": identityOrigin,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    return c.json({ message: message || "Sign-in failed" }, 401);
  }

  const cookie = collectSetCookieHeaders(response).map(value => value.split(";")[0]).join("; ");
  const exchange = await fetch(new URL("/auth/edaya/access-token", baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "origin": identityOrigin,
      ...(cookie ? { cookie } : {}),
    },
    body: "{}",
  });
  if (!exchange.ok) {
    return c.json({ message: "Identity token exchange failed" }, 401);
  }
  return c.newResponse(exchange.body, {
    status: 200,
    headers: { "content-type": exchange.headers.get("content-type") ?? "application/json" },
  });
}

export async function handleGraphiQLLogout(c: Context<AppBindings>) {
  if (!isGraphiQLEnabled(c.env?.NODE_ENV)) {
    return c.json({ message: "GraphiQL login is disabled" }, 404);
  }

  return c.body(null, 204);
}
