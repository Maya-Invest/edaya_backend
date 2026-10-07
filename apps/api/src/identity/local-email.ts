import type { CloudflareEmailBinding, Environment } from "./env";
import { z } from "zod";

const deliveryResponse = z.object({
  success: z.literal(true),
  result: z.object({
    delivered: z.array(z.string()),
    queued: z.array(z.string()),
    permanent_bounces: z.array(z.string()),
  }),
});

/** REST transport for local processes; Workers keep their native EMAIL binding. */
export function createLocalEmailBinding(
  env: Pick<Environment, "RUNTIME" | "EMAIL_TRANSPORT" | "CLOUDFLARE_EMAIL_ACCOUNT_ID" | "CLOUDFLARE_EMAIL_API_TOKEN">,
  warn: (message: string) => void,
  send: (url: string, init: RequestInit) => Promise<Response> = fetch,
): CloudflareEmailBinding | undefined {
  if (env.RUNTIME === "worker" || env.EMAIL_TRANSPORT === "log")
    return undefined;
  const accountId = env.CLOUDFLARE_EMAIL_ACCOUNT_ID?.trim();
  const token = env.CLOUDFLARE_EMAIL_API_TOKEN?.trim();
  if (!accountId || !token) {
    if (accountId || token || env.EMAIL_TRANSPORT === "cloudflare")
      warn("Local auth email delivery requires both CLOUDFLARE_EMAIL_ACCOUNT_ID and CLOUDFLARE_EMAIL_API_TOKEN; real email delivery is disabled.");
    return undefined;
  }
  return {
    async send(message) {
      const response = await send(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/email/sending/send`, {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: { "authorization": `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          ...message,
          from: typeof message.from === "string" ? message.from : { address: message.from.email, name: message.from.name },
        }),
      });
      if (!response.ok)
        throw new Error("Cloudflare auth email request failed");
      const parsed = deliveryResponse.safeParse(await response.json());
      if (!parsed.success)
        throw new Error("Invalid Cloudflare auth email response");
      const result = parsed.data.result;
      if (result.permanent_bounces.includes(message.to) || (!result.delivered.includes(message.to) && !result.queued.includes(message.to)))
        throw new Error("Cloudflare did not accept the auth email recipient");
    },
  };
}
