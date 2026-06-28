import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildBrowserUploadCorsOrigins,
  buildR2BucketCorsRules,
  buildWranglerR2CorsPolicy,
  configureR2BucketCors,
  isR2FileStorageConfigured,
  resolveR2EndpointFromEnv,
} from "@edaya/adaptor-r2";
import { trustedOriginsFromEnv } from "@/http/cors";
import { loadLocalProcessEnv } from "@/runtime/shared/env/local-loader";

const apiRoot = fileURLToPath(new URL("../..", import.meta.url));

function configureWithWrangler(bucketName: string, corsFile: string): boolean {
  const result = spawnSync(
    "bunx",
    ["wrangler", "r2", "bucket", "cors", "set", bucketName, "--file", corsFile, "-y"],
    {
      cwd: apiRoot,
      encoding: "utf8",
    },
  );

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return result.status === 0;
}

async function main() {
  const env = loadLocalProcessEnv();

  if (!isR2FileStorageConfigured(env)) {
    console.error(
      "R2 is not configured. Set R2_ENDPOINT (or R2_ACCOUNT_ID), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in apps/api/.dev.vars",
    );
    process.exit(1);
  }

  const allowedOrigins = buildBrowserUploadCorsOrigins(trustedOriginsFromEnv(env.TRUSTED_ORIGINS));
  const corsDir = mkdtempSync(join(tmpdir(), "edaya-r2-cors-"));
  const corsFile = join(corsDir, "cors.json");
  writeFileSync(corsFile, `${JSON.stringify(buildWranglerR2CorsPolicy(allowedOrigins), null, 2)}\n`);

  console.log("Configuring R2 bucket CORS");
  console.log(`  bucket:   ${env.R2_BUCKET_NAME}`);
  console.log(`  origins:  ${allowedOrigins.join(", ")}`);
  console.log("");

  if (configureWithWrangler(env.R2_BUCKET_NAME, corsFile)) {
    console.log("R2 bucket CORS configured via wrangler.");
    return;
  }

  console.log("wrangler failed; trying S3 API with R2 credentials...");
  try {
    await configureR2BucketCors({
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucketName: env.R2_BUCKET_NAME,
      endpoint: env.R2_ENDPOINT,
    }, allowedOrigins);
    console.log(`R2 bucket CORS configured via S3 API (${resolveR2EndpointFromEnv(env)}).`);
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error("");
    console.error("Could not configure CORS automatically. Either:");
    console.error("  1. Run `wrangler login`, then retry `bun run configure:r2-cors`");
    console.error("  2. Set CORS manually in Cloudflare dashboard (R2 → bucket → Settings → CORS)");
    console.error(`  3. Apply this policy: ${corsFile}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
