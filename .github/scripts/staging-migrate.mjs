import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createReleaseContext } from "./staging-runtime.mjs";

// No Worker deployment, package publication, configuration updates or traffic resume.
export async function migrateStaging(ctx) {
  ctx.requirePhase("prepared");
  await ctx.assertMaintenance();
  ctx.command("bun", ["tooling/repo/db/school/staging-preflight.ts"], ctx.backend);
  ctx.setPhase("migrating");
  ctx.mark(ctx.options.reset ? "Resetting and migrating staging schemas" : "Migrating staging without resetting data");
  ctx.command("bun", ["tooling/repo/db/identity/staging-release.ts"], ctx.backend);
  ctx.command("bun", ["tooling/repo/db/school/staging-release.ts"], ctx.backend);
  ctx.setPhase("migrated");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await migrateStaging(await createReleaseContext()); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
