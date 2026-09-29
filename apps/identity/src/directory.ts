import type { Context } from "hono";
import type { SQL } from "drizzle-orm";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { IDENTITY_DIRECTORY_SECRET_HEADER } from "@maya-invest/edaya-identity-client";
import type { IdentityRuntime } from "./runtime";

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[];
  }
  throw new Error("Unsupported auth database query result");
}
function directorySecretMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) {
    return false;
  }
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
function unauthorized(): Response {
  return Response.json({ message: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
}
type DirectoryContext = Context<{
  Bindings: IdentityRuntime["env"];
  Variables: {
    runtime: IdentityRuntime;
  };
}>;
export async function requireDirectorySecret(c: DirectoryContext): Promise<Response | null> {
  const expected = c.var.runtime.env.IDENTITY_DIRECTORY_SECRET;
  const provided = c.req.header(IDENTITY_DIRECTORY_SECRET_HEADER) ?? undefined;
  return directorySecretMatches(provided, expected) ? null : unauthorized();
}
export async function lookupDirectoryByContact(c: DirectoryContext): Promise<Response> {
  const denied = await requireDirectorySecret(c);
  if (denied) {
    return denied;
  }
  const channel = c.req.query("channel")?.trim();
  const value = c.req.query("value")?.trim();
  if (channel !== "email" && channel !== "phone") {
    return c.json({ message: "channel must be email or phone" }, 400);
  }
  if (!value) {
    return c.json({ message: "value is required" }, 400);
  }
  const db = c.var.runtime.db as {
    execute: (query: SQL) => Promise<unknown>;
  };
  const normalized = channel === "email" ? value.toLowerCase() : value.replace(/[ ().-]/g, "");
  const [row] = rows<{
    id: string;
  }>(await db.execute(sql`
    SELECT account_id AS id FROM identity.identifier WHERE kind=${channel} AND value=${normalized} AND revoked_at IS NULL LIMIT 1
  `));
  return c.json(row ? { exists: true, id: row.id } : { exists: false });
}
export async function resolveDirectoryById(c: DirectoryContext): Promise<Response> {
  const denied = await requireDirectorySecret(c);
  if (denied) {
    return denied;
  }
  const subjectId = c.req.param("subjectId")?.trim();
  if (!subjectId) {
    return c.json({ message: "subjectId is required" }, 400);
  }
  const db = c.var.runtime.db as {
    execute: (query: SQL) => Promise<unknown>;
  };
  const contacts = rows<{
    kind: "email" | "phone";
    value: string;
  }>(await db.execute(sql`
    SELECT kind,value FROM identity.identifier WHERE account_id=${subjectId} AND revoked_at IS NULL ORDER BY verified_at,id
  `));
  if (contacts.length === 0) {
    return c.json({ message: "Unknown subject" }, 404);
  }
  return c.json({ email: contacts.find(i => i.kind === "email")?.value, phone: contacts.find(i => i.kind === "phone")?.value, identifiers: contacts });
}
