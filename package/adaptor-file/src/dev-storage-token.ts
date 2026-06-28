import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

export type DevStorageOperation = "upload" | "download";

export interface DevStorageTokenPayload {
  operation: DevStorageOperation;
  key: string;
  expiresAt: number;
  contentType?: string;
}

function buildTokenMessage(payload: DevStorageTokenPayload): string {
  return `${payload.operation}:${payload.key}:${payload.expiresAt}:${payload.contentType ?? ""}`;
}

export function createDevStorageToken(
  secret: string,
  payload: DevStorageTokenPayload,
): string {
  return createHmac("sha256", secret)
    .update(buildTokenMessage(payload))
    .digest("hex");
}

export function verifyDevStorageToken(
  secret: string,
  payload: DevStorageTokenPayload,
  token: string,
): boolean {
  const expected = createDevStorageToken(secret, payload);
  const expectedBuffer = Buffer.from(expected, "hex");
  const tokenBuffer = Buffer.from(token, "hex");
  if (expectedBuffer.length !== tokenBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, tokenBuffer);
}

export function isDevStorageTokenExpired(expiresAt: number, now = Date.now()): boolean {
  return expiresAt <= now;
}
