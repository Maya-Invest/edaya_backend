/// <reference types="@cloudflare/workers-types" />

import {
  normalizeRecipients,
  parseFromAddress,
  parseNovuEmailWebhookPayload,
  verifyNovuEmailWebhookSignature,
} from "./novu-email-webhook";

export interface Env {
  EMAIL: SendEmail;
  NOVU_EMAIL_WEBHOOK_SECRET: string;
  DEFAULT_FROM_NAME?: string;
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return jsonResponse(405, { error: "method_not_allowed" });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-novu-signature");
    const secret = env.NOVU_EMAIL_WEBHOOK_SECRET;

    if (!secret) {
      return jsonResponse(500, { error: "webhook_secret_not_configured" });
    }

    const verified = await verifyNovuEmailWebhookSignature(rawBody, secret, signature);
    if (!verified) {
      return jsonResponse(401, { error: "invalid_signature" });
    }

    let payload;
    try {
      payload = parseNovuEmailWebhookPayload(rawBody);
    }
    catch (error) {
      const message = error instanceof Error ? error.message : "invalid_payload";
      return jsonResponse(400, { error: message });
    }

    const recipients = normalizeRecipients(payload.to);
    if (recipients.length === 0) {
      return jsonResponse(400, { error: "no_recipients" });
    }

    const from = parseFromAddress(payload.from, env.DEFAULT_FROM_NAME);
    const html = payload.html ?? payload.text ?? "";
    const text = payload.text ?? payload.html?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";

    const results: Array<{ to: string; ok: boolean; error?: string }> = [];
    for (const to of recipients) {
      try {
        await env.EMAIL.send({
          to,
          from,
          subject: payload.subject,
          html: html || text,
          text: text || html,
        });
        results.push({ to, ok: true });
      }
      catch (error) {
        const message = error instanceof Error ? error.message : "send_failed";
        results.push({ to, ok: false, error: message });
      }
    }

    const failed = results.filter(result => !result.ok);
    if (failed.length === results.length) {
      return jsonResponse(502, { error: "send_failed", results });
    }

    return jsonResponse(200, {
      ok: true,
      sent: results.filter(result => result.ok).length,
      failed: failed.length,
      results,
    });
  },
} satisfies ExportedHandler<Env>;
