import { serve } from "@hono/node-server";
import app from "./app";
import env from "./lib/bootstrap/env-runtime";

serve({
  fetch: app.fetch,
  port: env.PORT,
});

// eslint-disable-next-line no-console
console.log(`Server is running on port http://localhost:${env.PORT}`);
