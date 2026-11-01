import { Hono } from "hono";
import { cors } from "hono/cors";
import { createLocalFileObjectStore } from "./object-store";
import { verifyLocalFileToken } from "./tokens";
import type { LocalFileStorageConfig } from "./types";
import { assertStorageReadLimit, FileStorageReadError, readBoundedStorageBody } from "@edaya/core";

function parseAllowedOrigins(config: LocalFileStorageConfig): string[] {
  return (config.allowedOrigins ?? [])
    .map(origin => origin.trim())
    .filter(Boolean);
}

function isAuthorized(secret: string, authorization: string | undefined): boolean {
  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }
  return authorization.slice("Bearer ".length) === secret;
}

function contentDisposition(
  disposition: "inline" | "attachment" | undefined,
  fileName: string | undefined,
): string | undefined {
  if (!fileName) {
    return disposition;
  }
  const safeName = fileName.replace(/[^\u0020-\u007E]/g, "-").replace(/["\\]/g, "");
  return `${disposition ?? "attachment"}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function createLocalFileStorageApp(config: LocalFileStorageConfig): Hono {
  const store = createLocalFileObjectStore({ rootDir: config.rootDir });
  const allowedOrigins = parseAllowedOrigins(config);
  const app = new Hono();

  app.use(
    "/upload",
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
      allowMethods: ["PUT", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );
  app.use(
    "/download",
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
      allowMethods: ["GET", "OPTIONS"],
    }),
  );

  app.get("/health", c => c.json({ status: "ok" }));

  app.put("/upload", async (c) => {
    try {
      const token = c.req.query("token");
      if (!token) {
        return c.text("Missing token", 400);
      }

      const payload = verifyLocalFileToken(config.secret, token);
      if (payload.op !== "upload") {
        return c.text("Invalid upload token", 400);
      }

      const requestContentType = c.req.header("content-type") ?? "application/octet-stream";
      if (requestContentType !== payload.contentType) {
        return c.text("Content-Type mismatch", 400);
      }

      if (!c.req.raw.body) {
        return c.text("Upload body required", 400);
      }
      const body = await readBoundedStorageBody(c.req.raw.body, payload.sizeBytes);
      if (body.byteLength !== payload.sizeBytes) {
        return c.text("Upload size mismatch", 400);
      }
      const result = await store.putObject({
        key: payload.key,
        body,
        contentType: payload.contentType,
      });
      return c.json({ sizeBytes: result.sizeBytes });
    }
    catch (error) {
      if (error instanceof FileStorageReadError) {
        return c.text(error.code, 413);
      }
      const message = error instanceof Error ? error.message : "Upload failed";
      const status = message.includes("expired") || message.includes("Invalid") ? 403 : 500;
      return c.text(message, status);
    }
  });

  app.get("/download", async (c) => {
    try {
      const token = c.req.query("token");
      if (!token) {
        return c.text("Missing token", 400);
      }

      const payload = verifyLocalFileToken(config.secret, token);
      if (payload.op !== "download") {
        return c.text("Invalid download token", 400);
      }

      const stored = await store.readObject(payload.key);
      if (!stored) {
        return c.text("Not found", 404);
      }

      const headers: Record<string, string> = {};
      const resolvedContentType = stored.contentType ?? "application/octet-stream";
      headers["Content-Type"] = resolvedContentType;
      const disposition = contentDisposition(payload.disposition, payload.fileName);
      if (disposition) {
        headers["Content-Disposition"] = disposition;
      }

      return new Response(stored.body, { status: 200, headers });
    }
    catch (error) {
      const message = error instanceof Error ? error.message : "Download failed";
      const status = message.includes("expired") || message.includes("Invalid") ? 403 : 500;
      return c.text(message, status);
    }
  });

  app.put("/internal/objects", async (c) => {
    if (!isAuthorized(config.secret, c.req.header("authorization"))) {
      return c.text("Unauthorized", 401);
    }

    const rawKey = c.req.header("x-storage-key");
    if (!rawKey) {
      return c.text("Missing X-Storage-Key", 400);
    }

    try {
      // HTTP headers cannot carry arbitrary Unicode. Retain compatibility with
      // local clients sending unencoded ASCII keys.
      const key = c.req.header("x-storage-key-encoding") === "uri"
        ? decodeURIComponent(rawKey)
        : rawKey;
      const contentType = c.req.header("content-type") ?? "application/octet-stream";
      const body = new Uint8Array(await c.req.arrayBuffer());
      const result = await store.putObject({ key, body, contentType });
      return c.json({ sizeBytes: result.sizeBytes });
    }
    catch (error) {
      const message = error instanceof Error ? error.message : "putObject failed";
      return c.text(message, 400);
    }
  });

  app.get("/internal/objects/metadata", async (c) => {
    if (!isAuthorized(config.secret, c.req.header("authorization"))) {
      return c.text("Unauthorized", 401);
    }

    const key = c.req.query("key");
    if (!key) {
      return c.text("Missing key", 400);
    }

    try {
      const head = await store.headObject(key);
      if (!head) {
        return c.text("Not found", 404);
      }
      return c.json(head);
    }
    catch (error) {
      const message = error instanceof Error ? error.message : "headObject failed";
      return c.text(message, 400);
    }
  });

  app.get("/internal/objects/content", async (c) => {
    if (!isAuthorized(config.secret, c.req.header("authorization"))) {
      return c.text("Unauthorized", 401);
    }
    try {
      const key = c.req.query("key");
      const maxBytes = Number(c.req.query("maxBytes"));
      assertStorageReadLimit(maxBytes);
      if (!key) {
        return c.text("Missing key", 400);
      }
      const stored = await store.readObject(key, maxBytes);
      if (!stored) {
        return c.text("Not found", 404);
      }
      return new Response(stored.body, { headers: {
        "Content-Type": stored.contentType ?? "application/octet-stream",
        "Content-Length": String(stored.body.byteLength),
        "Cache-Control": "no-store",
      } });
    }
    catch (error) {
      if (error instanceof FileStorageReadError) {
        return c.text(error.code, error.code === "FILE_READ_LIMIT_EXCEEDED" ? 413 : 400);
      }
      return c.text("FILE_READ_FAILED", 500);
    }
  });

  app.delete("/internal/objects", async (c) => {
    if (!isAuthorized(config.secret, c.req.header("authorization"))) {
      return c.text("Unauthorized", 401);
    }

    const key = c.req.query("key");
    if (!key) {
      return c.text("Missing key", 400);
    }

    try {
      await store.deleteObject(key);
      return c.body(null, 204);
    }
    catch (error) {
      const message = error instanceof Error ? error.message : "deleteObject failed";
      return c.text(message, 400);
    }
  });

  return app;
}
