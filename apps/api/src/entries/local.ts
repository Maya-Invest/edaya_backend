import { serve } from "@hono/node-server";
import app from "@/app";
import { loadLocalProcessEnv } from "@/runtime";

async function main(): Promise<void> {
  const env = loadLocalProcessEnv();

  serve({
    fetch: request => app.fetch(request, env),
    port: env.PORT,
  });

  // eslint-disable-next-line no-console -- local dev startup banner
  console.log(`Server is running on port http://localhost:${env.PORT} (${env.RUNTIME} runtime)`);
}

main().catch((error: unknown) => {
  console.error("Failed to start local API:", error);
  process.exit(1);
});
