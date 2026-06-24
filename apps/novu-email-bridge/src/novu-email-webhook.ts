export interface NovuEmailWebhookPayload {
  to: string | string[];
  from: string;
  subject: string;
  html?: string;
  text?: string;
}

export function parseNovuEmailWebhookPayload(rawBody: string): NovuEmailWebhookPayload {
  const parsed: unknown = JSON.parse(rawBody);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid Novu email webhook payload");
  }

  const record = parsed as Record<string, unknown>;
  const to = record.to;
  const from = record.from;
  const subject = record.subject;

  if (
    (typeof to !== "string" && !Array.isArray(to))
    || (Array.isArray(to) && to.some(entry => typeof entry !== "string"))
  ) {
    throw new Error("Invalid Novu email webhook payload: to");
  }
  if (typeof from !== "string" || from.trim().length === 0) {
    throw new Error("Invalid Novu email webhook payload: from");
  }
  if (typeof subject !== "string") {
    throw new Error("Invalid Novu email webhook payload: subject");
  }

  return {
    to,
    from,
    subject,
    html: typeof record.html === "string" ? record.html : undefined,
    text: typeof record.text === "string" ? record.text : undefined,
  };
}

export function normalizeRecipients(to: string | string[]): string[] {
  const values = Array.isArray(to) ? to : [to];
  return [...new Set(values.map(value => value.trim()).filter(value => value.length > 0))];
}

export function parseFromAddress(from: string, defaultName?: string): { email: string; name?: string } {
  const match = from.match(/^(.*)<([^>]+)>$/);
  if (match) {
    const name = match[1]?.trim().replace(/^"|"$/g, "");
    const email = match[2]?.trim();
    if (email) {
      return name ? { email, name } : { email };
    }
  }

  return defaultName ? { email: from.trim(), name: defaultName } : { email: from.trim() };
}

export async function computeNovuEmailWebhookSignature(
  rawBody: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyNovuEmailWebhookSignature(
  rawBody: string,
  secret: string,
  providedSignature: string | null,
): Promise<boolean> {
  if (!providedSignature || providedSignature.trim().length === 0) {
    return false;
  }

  const expected = await computeNovuEmailWebhookSignature(rawBody, secret);
  return timingSafeEqualHex(expected, providedSignature.trim().toLowerCase());
}

function timingSafeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}
