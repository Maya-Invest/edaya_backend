import { serve } from "@hono/node-server";
import app from "@/app";
import { loadNodeProcessEnv } from "@/lib/runtime/node";
import { getApiRuntime } from "@/lib/runtime/registry";
import { DEV_AUTH_PASSWORD, maybeSeedAccessDatabase, maybeSeedAuthDatabase, maybeSeedDatabase } from "@/lib/seed";

const env = loadNodeProcessEnv();
const runtime = await getApiRuntime(env);
const application = await runtime.getSchoolApplication();
const seedResult = await maybeSeedDatabase(application, env);
const authSeedResult = await maybeSeedAuthDatabase(application, runtime.getAuth(), env);
const accessSeedResult = await maybeSeedAccessDatabase(application, env);

if (seedResult?.status === "seeded") {
  // eslint-disable-next-line no-console
  console.log(`Dev seed loaded (${seedResult.schoolId}): ${seedResult.students} students, ${seedResult.staff} staff`);
}

if (authSeedResult?.status === "seeded") {
  const emails = authSeedResult.accounts.map(account => account.email).join(", ");
  // eslint-disable-next-line no-console
  console.log(`Dev auth seed linked ${authSeedResult.linkedStaff} staff and ${authSeedResult.linkedGuardians} guardian(s): ${emails} (password: ${DEV_AUTH_PASSWORD})`);
}

if (accessSeedResult?.status === "seeded") {
  // eslint-disable-next-line no-console
  console.log(`Dev access seed loaded: ${accessSeedResult.roles} roles, ${accessSeedResult.assignments} assignments`);
}

serve({
  fetch: request => app.fetch(request, env),
  port: env.PORT,
});

// eslint-disable-next-line no-console
console.log(`Server is running on port http://localhost:${env.PORT} (node runtime)`);
