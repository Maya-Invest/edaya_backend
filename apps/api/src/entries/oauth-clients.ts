/* eslint-disable node/no-process-env, no-console -- Operator CLI reads explicit process configuration and prints credential-free status. */
import { open, readFile, unlink } from "node:fs/promises";
import process from "node:process";
import { createAuthTransactions, createOAuthClientRegistry } from "@edaya/adaptor-auth";
import { z } from "zod";
import { externalOAuthScopes } from "@/lib/integrations/scopes";
import { createPostgresAuthDatabase } from "@/runtime/shared/auth-database";

const clientSchema = z.object({
  clientId: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,63}$/),
  name: z.string().trim().min(1).max(120),
  purpose: z.string().trim().min(1).max(1000),
  redirectUris: z.array(z.string().url().refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password && !url.hash && !value.includes("*")
      && (url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:"
        && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
  }, "Use an exact HTTPS redirect URI; local HTTP is allowed only outside production")).min(1).max(10),
  scopes: z.array(z.string().refine(scope => externalOAuthScopes.includes(scope))).min(1).max(externalOAuthScopes.length),
  confidential: z.boolean(),
}).strict();

async function main() {
  const [action, argument, secretOutput] = process.argv.slice(2);
  if (!argument || !["register", "disable", "rotate"].includes(action ?? "")) {
    throw new Error("Usage: oauth-clients.ts register <client.json> [secret-output.json] | disable <client-id> | rotate <client-id> <secret-output.json>");
  }
  const databaseUrl = process.env.AUTH_DATABASE_URL;
  if (!databaseUrl?.startsWith("postgres")) {
    throw new Error("Set AUTH_DATABASE_URL explicitly to the intended auth database; migrations must already be applied");
  }
  const input = action === "register" ? clientSchema.parse(JSON.parse(await readFile(argument, "utf8"))) : undefined;
  const needsSecret = action === "rotate" || input?.confidential;
  if (needsSecret && !secretOutput) {
    throw new Error("Provide a new secret-output.json path; credentials are never printed");
  }
  // Reserve the credential file before changing the database. Never overwrite.
  const output = needsSecret ? await open(secretOutput!, "wx", 0o600) : undefined;
  let completed = false;
  try {
    const handle = await createPostgresAuthDatabase(databaseUrl);
    try {
      const transactions = createAuthTransactions(handle.db);
      const registry = createOAuthClientRegistry(transactions.db);
      await transactions.execute(async () => {
        const result = input
          ? await registry.register(input)
          : action === "rotate" ? await registry.rotate(argument) : await registry.disable(argument);
        if (output) {
          await output.writeFile(JSON.stringify(result, null, 2));
          await output.sync();
        }
      });
      completed = true;
      console.log(`OAuth client ${action} completed${output ? "; credential saved to the requested private file" : ""}.`);
    }
    finally {
      await handle.dispose();
    }
  }
  finally {
    await output?.close();
    if (output && !completed) {
      await unlink(secretOutput!);
    }
  }
}

if (import.meta.main) {
  main().catch(() => {
    // Database/driver exceptions can contain SQL parameters or connection URLs.
    console.error("OAuth client operation failed. Check command arguments, explicit auth database, migrations, and output file permissions.");
    process.exitCode = 1;
  });
}
