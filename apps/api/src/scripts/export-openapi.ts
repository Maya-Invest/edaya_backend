/* eslint-disable node/no-process-env */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import app from "@/app";
import { loadNodeProcessEnv } from "@/runtime/env/node-loader";
import { resetApiRuntimesForTests } from "@/runtime";

// Load environment variables before importing app to ensure all dependencies initialize properly
loadNodeProcessEnv();

async function main() {
  const res = await app.request("/doc", undefined, process.env);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch OpenAPI doc: ${res.status}\nBody: ${body}`);
  }
  const schema = await res.json();

  // Resolve path to the webapp src/lib/api folder
  const outputPath = resolve(import.meta.dirname, "../../../webapp/src/lib/api/openapi.json");

  // Ensure the directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  // Write the exported schema
  writeFileSync(outputPath, JSON.stringify(schema, null, 2));

  // eslint-disable-next-line no-console
  console.log(`OpenAPI schema successfully exported to ${outputPath}`);
  await resetApiRuntimesForTests();
}

main().catch((err) => {
  console.error("Failed to export OpenAPI schema:", err);
  process.exit(1);
});
