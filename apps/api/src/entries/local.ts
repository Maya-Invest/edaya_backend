import { serve } from "@hono/node-server";
import app from "@/app";
import { maybeRunLocalStartupSeed, WIPE_AND_RESEED_HINT } from "@/dev/local-startup-seed";
import { loadLocalProcessEnv } from "@/runtime";

async function main(): Promise<void> {
  const env = loadLocalProcessEnv();

  serve({
    fetch: request => app.fetch(request, env),
    port: env.PORT,
  });

  await maybeRunLocalStartupSeed(env).catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error("SEED_ON_START failed:", error);
    // eslint-disable-next-line no-console
    console.error(WIPE_AND_RESEED_HINT);
  });

  // eslint-disable-next-line no-console
  console.log(`Server is running on port http://localhost:${env.PORT} (${env.RUNTIME} runtime)`);
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start local API:", error);
  process.exit(1);
});
