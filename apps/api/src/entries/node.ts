import { serve } from "@hono/node-server";
import app from "@/app";
import { loadNodeProcessEnv } from "@/lib/runtime/node";
import { getApiRuntime } from "@/lib/runtime/registry";
import { maybeSeedDatabase } from "@/lib/seed";

const env = loadNodeProcessEnv();
const runtime = await getApiRuntime(env);
const seedResult = await maybeSeedDatabase(await runtime.getSchoolApplication(), env);

if (seedResult?.status === "seeded") {
  // eslint-disable-next-line no-console
  console.log(`Dev seed loaded (${seedResult.schoolId}): ${seedResult.students} students, ${seedResult.staff} staff`);
}

serve({
  fetch: request => app.fetch(request, env),
  port: env.PORT,
});

// eslint-disable-next-line no-console
console.log(`Server is running on port http://localhost:${env.PORT} (node runtime)`);
