import { loadNodeProcessEnv } from "@/lib/runtime/node";
import { getApiRuntime } from "@/lib/runtime/registry";
import { runDevSeed } from "@/lib/seed/run-dev-seed";

const env = loadNodeProcessEnv();
const runtime = await getApiRuntime(env);
const result = await runDevSeed(await runtime.getSchoolApplication());

if (result.status === "skipped") {
  // eslint-disable-next-line no-console
  console.log(`Seed skipped (${result.reason}): ${result.schoolCount} school(s) already in database.`);
}
else {
  // eslint-disable-next-line no-console
  console.log("Dev database seeded:", result);
}

if (env.DATABASE_URL === "pglite" || env.DATABASE_URL === "memory") {
  // eslint-disable-next-line no-console
  console.log("Note: in-memory data is lost when the API process exits.");
}
