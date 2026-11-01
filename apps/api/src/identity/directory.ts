import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { IdentityRuntime } from "./runtime";
import type { DirectoryClient } from "./server";

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result))
    return result as T[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows))
    return result.rows as T[];
  throw new Error("Unsupported Account query result");
}
/** Typed Account directory; no network, service binding or shared secret. */
export function createAccountDirectory(resolve: () => Promise<IdentityRuntime>): DirectoryClient {
  return {
    async lookupByContact(channel, value) {
      const runtime = await resolve();
      const db = runtime.db as { execute: (query: SQL) => Promise<unknown> };
      const normalized = channel === "email" ? value.trim().toLowerCase() : value.trim().replace(/[ ().-]/g, "");
      const [row] = rows<{ id: string }>(await db.execute(sql`SELECT account_id AS id FROM identity.identifier WHERE kind=${channel} AND value=${normalized} AND revoked_at IS NULL LIMIT 1`));
      return row ? { exists: true, id: row.id } : { exists: false };
    },
    async resolveBySubjectId(subjectId) {
      const runtime = await resolve();
      const db = runtime.db as { execute: (query: SQL) => Promise<unknown> };
      const contacts = rows<{ kind: "email" | "phone"; value: string }>(await db.execute(sql`SELECT kind,value FROM identity.identifier WHERE account_id=${subjectId} AND revoked_at IS NULL ORDER BY verified_at,id`));
      if (!contacts.length)
        return undefined;
      return { email: contacts.find(i => i.kind === "email")?.value, phone: contacts.find(i => i.kind === "phone")?.value, identifiers: contacts };
    },
  };
}
