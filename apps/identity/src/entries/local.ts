import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import app from "../app";
import { loadLocalProcessEnv } from "../env";
import { attachIdentityRuntime, createIdentityRuntime } from "../runtime";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env"), override: false });
async function main(): Promise<void> {
  const env = loadLocalProcessEnv();
  const runtime = await createIdentityRuntime(env);
  attachIdentityRuntime(env, runtime);
  serve({
    fetch: request => app.fetch(request, env),
    port: env.PORT,
  });
  console.log(`Edaya Identity is running on http://localhost:${env.PORT} (${env.RUNTIME})`);
}
main().catch((error: unknown) => {
  console.error("Failed to start identity:", error);
  process.exit(1);
});
