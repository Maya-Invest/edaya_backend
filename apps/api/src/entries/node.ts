import { serve } from "@hono/node-server";
import app from "@/app";
import { loadNodeProcessEnv } from "@/lib/runtime/node";

const env = loadNodeProcessEnv();

serve({
  fetch: request => app.fetch(request, env),
  port: env.PORT,
});

// eslint-disable-next-line no-console
console.log(`Server is running on port http://localhost:${env.PORT} (node runtime)`);
