import { Hono } from "hono";
import { cors } from "hono/cors";
import { createLocalFileObjectStore } from "./object-store";
import { verifyLocalFileToken } from "./tokens";
import type { LocalFileStorageConfig } from "./types";

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
  const safeName = fileName.replace(/"/g, "");
  return `${disposition ?? "attachment"}; filename="${safeName}"`;
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

      const body = new Uint8Array(await c.req.arrayBuffer());
      const result = await store.putObject({
        key: payload.key,
        body,
        contentType: payload.contentType,
      });
      return c.json({ sizeBytes: result.sizeBytes });
    }
    catch (error) {
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

    const key = c.req.header("x-storage-key");
    if (!key) {
      return c.text("Missing X-Storage-Key", 400);
    }

    try {
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
