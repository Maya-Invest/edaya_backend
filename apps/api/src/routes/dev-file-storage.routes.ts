import type { Context } from "hono";
import { Buffer } from "node:buffer";
import type { AppBindings } from "@/http/types";
import { schoolApiPath } from "@/lib/school-api/routes/paths";
import { resolveLocalDevFileStorageRoot } from "@/runtime/shared/adapters/file-storage";
import {
  isDevStorageTokenExpired,
  readLocalDevObject,
  verifyDevStorageToken,
  writeLocalDevObject,
} from "@edaya/adaptor-file";
import * as HttpStatusCodes from "stoker/http-status-codes";

function isDevelopmentStorageEnabled(c: Context<AppBindings>): boolean {
  return c.env.NODE_ENV === "development" && c.env.RUNTIME === "local";
}

function parseSignedRequest(c: Context<AppBindings>, operation: "upload" | "download") {
  const key = c.req.query("key");
  const expires = c.req.query("expires");
  const sig = c.req.query("sig");
  const contentType = c.req.query("contentType") ?? undefined;

  if (!key || !expires || !sig) {
    return { error: c.json({ message: "Missing signed upload parameters" }, HttpStatusCodes.BAD_REQUEST) };
  }

  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt)) {
    return { error: c.json({ message: "Invalid expires parameter" }, HttpStatusCodes.BAD_REQUEST) };
  }

  if (isDevStorageTokenExpired(expiresAt)) {
    return { error: c.json({ message: "Signed URL expired" }, HttpStatusCodes.GONE) };
  }

  const valid = verifyDevStorageToken(c.env.BETTER_AUTH_SECRET, {
    operation,
    key,
    expiresAt,
    contentType,
  }, sig);

  if (!valid) {
    return { error: c.json({ message: "Invalid signature" }, HttpStatusCodes.FORBIDDEN) };
  }

  return { key, contentType };
}

export async function devFileUploadHandler(c: Context<AppBindings>) {
  if (!isDevelopmentStorageEnabled(c)) {
    return c.json({ message: "Not found" }, HttpStatusCodes.NOT_FOUND);
  }

  const parsed = parseSignedRequest(c, "upload");
  if ("error" in parsed) {
    return parsed.error;
  }

  const contentType = parsed.contentType ?? c.req.header("content-type") ?? "application/octet-stream";
  const body = new Uint8Array(await c.req.arrayBuffer());
  await writeLocalDevObject(
    resolveLocalDevFileStorageRoot(c.env),
    parsed.key,
    body,
    contentType,
  );

  return c.body(null, HttpStatusCodes.NO_CONTENT);
}

export async function devFileDownloadHandler(c: Context<AppBindings>) {
  if (!isDevelopmentStorageEnabled(c)) {
    return c.json({ message: "Not found" }, HttpStatusCodes.NOT_FOUND);
  }

  const parsed = parseSignedRequest(c, "download");
  if ("error" in parsed) {
    return parsed.error;
  }

  const stored = await readLocalDevObject(
    resolveLocalDevFileStorageRoot(c.env),
    parsed.key,
  );
  if (!stored) {
    return c.json({ message: "Object not found" }, HttpStatusCodes.NOT_FOUND);
  }

  const fileName = c.req.query("fileName");
  const headers: Record<string, string> = {
    "Content-Type": stored.contentType ?? "application/octet-stream",
  };
  if (fileName) {
    headers["Content-Disposition"] = `attachment; filename="${fileName.replace(/"/g, "")}"`;
  }

  return c.newResponse(Buffer.from(stored.body), HttpStatusCodes.OK, headers);
}

export const devFileUploadPath = schoolApiPath("dev", "files", "upload");
export const devFileDownloadPath = schoolApiPath("dev", "files", "download");
