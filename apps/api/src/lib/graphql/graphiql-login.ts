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

function returnAuthResponse(c: Context<AppBindings>, response: Response) {
  const headers = new Headers();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      return;
    }
    headers.set(key, value);
  });

  for (const cookie of collectSetCookieHeaders(response)) {
    c.header("Set-Cookie", cookie, { append: true });
  }

  return c.newResponse(response.body, {
    status: response.status as 200,
    headers,
  });
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

  const auth = c.get("auth");
  const baseUrl = c.env?.BETTER_AUTH_URL ?? "http://localhost:9999";
  const url = new URL("/auth/sign-in/email", baseUrl);
  const response = await auth.handler(new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  }));

  if (!response.ok) {
    const message = await response.text();
    return c.json({ message: message || "Sign-in failed" }, 401);
  }

  return returnAuthResponse(c, response);
}

export async function handleGraphiQLLogout(c: Context<AppBindings>) {
  if (!isGraphiQLEnabled(c.env?.NODE_ENV)) {
    return c.json({ message: "GraphiQL login is disabled" }, 404);
  }

  const auth = c.get("auth");
  const baseUrl = c.env?.BETTER_AUTH_URL ?? "http://localhost:9999";
  const url = new URL("/auth/sign-out", baseUrl);
  const response = await auth.handler(new Request(url, {
    method: "POST",
    headers: c.req.raw.headers,
  }));

  return returnAuthResponse(c, response);
}
