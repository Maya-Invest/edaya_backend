import type { AccountService } from "@edaya/account";
import type { Environment } from "./env";
import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const receiptSchema = z.object({
  id: z.string().min(1).max(256),
  recipient_id: z.string().regex(/^\d{7,15}$/),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  timestamp: z.string().regex(/^\d{1,12}$/),
  biz_opaque_callback_data: z.string().max(128).optional(),
});
const payloadSchema = z.object({ object: z.literal("whatsapp_business_account"), entry: z.array(z.object({ id: z.string(), changes: z.array(z.object({ field: z.string(), value: z.object({ metadata: z.object({ phone_number_id: z.string() }).optional(), statuses: z.array(z.unknown()).optional() }) })) })) });

export function createWhatsAppWebhook(service: AccountService, env: Environment) {
  return async (request: Request): Promise<Response> => {
    const json = (status: number) => Response.json({ success: status === 200 }, { status, headers: { "cache-control": "no-store" } });
    if (!env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || !env.WHATSAPP_APP_SECRET || !env.WHATSAPP_BUSINESS_ACCOUNT_ID || !env.WHATSAPP_PHONE_NUMBER_ID)
      return json(503);
    if (request.method === "GET") {
      const query = new URL(request.url).searchParams;
      return query.get("hub.mode") === "subscribe" && query.get("hub.verify_token") === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && query.has("hub.challenge")
        ? new Response(query.get("hub.challenge"), { headers: { "cache-control": "no-store" } })
        : json(403);
    }
    if (request.method !== "POST")
      return json(405);
    const signature = request.headers.get("x-hub-signature-256") ?? "";
    if (!/^sha256=[a-f0-9]{64}$/.test(signature))
      return json(403);
    const raw = Buffer.from(await request.arrayBuffer());
    const expected = createHmac("sha256", env.WHATSAPP_APP_SECRET).update(raw).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex")))
      return json(403);
    let parsed;
    try {
      parsed = payloadSchema.safeParse(JSON.parse(raw.toString("utf8")) as unknown);
    }
    catch { return json(400); }
    if (!parsed.success)
      return json(400);
    try {
      for (const entry of parsed.data.entry) {
        if (entry.id !== env.WHATSAPP_BUSINESS_ACCOUNT_ID)
          continue;
        for (const change of entry.changes) {
          if (change.field !== "messages" || change.value.metadata?.phone_number_id !== env.WHATSAPP_PHONE_NUMBER_ID)
            continue;
          for (const rawStatus of change.value.statuses ?? []) {
            const receipt = receiptSchema.safeParse(rawStatus);
            if (!receipt.success)
              continue;
            const status = receipt.data;
            await service.recordReceipt({ id: `${status.id}:${status.status}:${status.timestamp}`, messageId: status.id, destination: `+${status.recipient_id}`, status: status.status, timestamp: Number(status.timestamp) * 1000, attemptId: status.biz_opaque_callback_data });
          }
        }
      }
      return json(200);
    }
    catch { return json(503); }
  };
}
