import { createHmac, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { assertStorageReadLimit } from "@edaya/core";

export type LocalFileTokenOperation = "upload" | "download";

export interface LocalFileUploadTokenPayload {
  op: "upload";
  key: string;
  contentType: string;
  sizeBytes: number;
  exp: number;
}

export interface LocalFileDownloadTokenPayload {
  op: "download";
  key: string;
  exp: number;
  fileName?: string;
  disposition?: "inline" | "attachment";
}

export type LocalFileTokenPayload = LocalFileUploadTokenPayload | LocalFileDownloadTokenPayload;

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(secret: string, encodedPayload: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createLocalFileToken(
  secret: string,
  payload: LocalFileTokenPayload,
): string {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(secret, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyLocalFileToken(
  secret: string,
  token: string,
): LocalFileTokenPayload {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Invalid token format");
  }

  const expectedSignature = signPayload(secret, encodedPayload);
  const provided = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error("Invalid token signature");
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload)) as LocalFileTokenPayload;
  if (!payload?.op || !payload?.key || typeof payload.exp !== "number") {
    throw new Error("Invalid token payload");
  }
  if (payload.op === "upload") {
    try {
      assertStorageReadLimit(payload.sizeBytes);
    }
    catch {
      throw new Error("Invalid upload size");
    }
  }
  if (payload.exp * 1000 <= Date.now()) {
    throw new Error("Token expired");
  }

  return payload;
}

export function buildUploadTokenPayload(
  input: { key: string; contentType: string; sizeBytes: number; expiresInSeconds?: number },
): LocalFileUploadTokenPayload {
  const expiresInSeconds = input.expiresInSeconds ?? 900;
  assertStorageReadLimit(input.sizeBytes);
  return {
    op: "upload",
    key: input.key,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    exp: Math.floor((Date.now() + expiresInSeconds * 1000) / 1000),
  };
}

export function buildDownloadTokenPayload(
  key: string,
  options?: { expiresInSeconds?: number; fileName?: string; disposition?: "inline" | "attachment" },
): LocalFileDownloadTokenPayload {
  const expiresInSeconds = options?.expiresInSeconds ?? 900;
  return {
    op: "download",
    key,
    exp: Math.floor((Date.now() + expiresInSeconds * 1000) / 1000),
    fileName: options?.fileName,
    disposition: options?.disposition,
  };
}
