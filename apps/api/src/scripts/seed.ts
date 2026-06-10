import { loadNodeProcessEnv } from "@/lib/runtime/node";
import { getApiRuntime } from "@/lib/runtime/registry";
import { DEV_AUTH_PASSWORD } from "@/lib/seed/dataset";
import { runDevAuthSeed } from "@/lib/seed/run-dev-auth-seed";
import { runDevSeed } from "@/lib/seed/run-dev-seed";

const env = loadNodeProcessEnv();
const runtime = await getApiRuntime(env);
const application = await runtime.getSchoolApplication();
const result = await runDevSeed(application);
const authResult = await runDevAuthSeed(application, runtime.getAuth(), env);

if (result.status === "skipped") {
  // eslint-disable-next-line no-console
  console.log(`Seed skipped (${result.reason}): ${result.schoolCount} school(s) already in database.`);
}
else {
  // eslint-disable-next-line no-console
  console.log("Dev database seeded:", result);
}

if (authResult.status === "seeded") {
  // eslint-disable-next-line no-console
  console.log("Dev auth accounts linked:", authResult.accounts, `(password: ${DEV_AUTH_PASSWORD})`);
}
else {
  // eslint-disable-next-line no-console
  console.log("Dev auth seed skipped:", authResult.reason);
}

if (env.DATABASE_URL === "pglite" || env.DATABASE_URL === "memory") {
  // eslint-disable-next-line no-console
  console.log("Note: in-memory data is lost when the API process exits.");
}
