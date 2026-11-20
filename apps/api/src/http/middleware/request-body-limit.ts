import { IMPORT_MAX_FILE_BYTES } from "@edaya/core";
import { bodyLimit } from "hono/body-limit";
import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "@/http/types";

const ordinaryLimit = bodyLimit({ maxSize: 1024 * 1024 });
// Base64 expands the file; the small remainder bounds the JSON metadata envelope.
const importLimit = bodyLimit({ maxSize: Math.ceil(IMPORT_MAX_FILE_BYTES / 3) * 4 + 4096 });

export const requestBodyLimit: MiddlewareHandler<AppBindings> = (c, next) => {
  if (c.req.path.startsWith("/core/files/memory/"))
    return next();
  if (c.req.method === "POST" && /^\/core\/imports\/submit\/?$/.test(c.req.path))
    return importLimit(c, next);
  return ordinaryLimit(c, next);
};
