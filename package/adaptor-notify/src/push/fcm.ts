interface GoogleServiceAccount {
  client_email?: string;
  private_key?: string;
  project_id?: string;
  token_uri?: string;
}

interface FcmSendInput {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function encodeJsonBase64Url(value: unknown): string {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replaceAll("\\n", "")
    .replaceAll("\n", "")
    .replaceAll("\r", "")
    .trim();
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index) ?? 0;
  }
  return bytes.buffer;
}

async function signRs256(pem: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  return encodeBase64Url(new Uint8Array(signature));
}

let cachedToken: { accessToken: string; expiresAt: number } | undefined;

async function googleAccessToken(account: GoogleServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.accessToken;
  }
  if (!account.client_email || !account.private_key) {
    throw new Error("FCM service account is missing client_email or private_key");
  }
  const header = encodeJsonBase64Url({ alg: "RS256", typ: "JWT" });
  const payload = encodeJsonBase64Url({
    iss: account.client_email,
    sub: account.client_email,
    aud: account.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  });
  const unsigned = `${header}.${payload}`;
  const assertion = `${unsigned}.${await signRs256(account.private_key, unsigned)}`;
  const response = await fetch(account.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`Google OAuth failed: ${response.status} ${await response.text()}`);
  }
  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) {
    throw new Error("Google OAuth response missing access_token");
  }
  cachedToken = {
    accessToken: body.access_token,
    expiresAt: now + (body.expires_in ?? 3600),
  };
  return body.access_token;
}

export interface FcmTransport {
  send: (input: FcmSendInput) => Promise<{ providerMessageId?: string }>;
}

export function createLogFcmTransport(log: (message: string, extra?: Record<string, unknown>) => void): FcmTransport {
  return {
    async send(input) {
      log("notify push (log transport)", { token: input.token.slice(0, 8), title: input.title });
      return { providerMessageId: `log-fcm:${input.title}` };
    },
  };
}

export function createFcmHttpV1Transport(serviceAccountJson: string): FcmTransport {
  const account = JSON.parse(serviceAccountJson) as GoogleServiceAccount;
  const projectId = account.project_id;
  if (!projectId) {
    throw new Error("FCM service account is missing project_id");
  }

  return {
    async send(input) {
      const accessToken = await googleAccessToken(account);
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: "POST",
        headers: {
          "authorization": `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: input.token,
            notification: {
              title: input.title,
              body: input.body,
            },
            data: input.data,
          },
        }),
      });
      if (!response.ok) {
        const failure = await response.json() as { error?: { details?: Array<{ errorCode?: string }> } };
        if (failure.error?.details?.some(detail => detail.errorCode === "UNREGISTERED"))
          throw new Error("FCM_TOKEN_UNREGISTERED");
        throw new Error(`FCM send failed: ${response.status}`);
      }
      const body = await response.json() as { name?: string };
      return { providerMessageId: body.name };
    },
  };
}

export function resolveFcmTransport(
  serviceAccountJson: string | undefined,
  log: (message: string, extra?: Record<string, unknown>) => void,
): FcmTransport {
  if (!serviceAccountJson?.trim()) {
    return createLogFcmTransport(log);
  }
  return createFcmHttpV1Transport(serviceAccountJson);
}
