/* eslint-disable node/no-process-env */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import app from "@/app";
import { buildClientBindings, CLIENT_BINDINGS_OPENAPI_EXTENSION } from "@/lib/school-api/client-bindings";
import { loadNodeProcessEnv } from "@/runtime/env/node-loader";
import { resetApiRuntimesForTests } from "@/runtime";

// Load environment variables before importing app to ensure all dependencies initialize properly
loadNodeProcessEnv();

function resolveOutputPath(): string {
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex === -1) {
    return resolve(import.meta.dirname, "../../../webapp/src/lib/api/openapi.json");
  }

  const requestedPath = process.argv[outputIndex + 1];
  if (!requestedPath) {
    throw new Error("--output requires a file path");
  }
  return resolve(process.cwd(), requestedPath);
}

async function main() {
  const res = await app.request("/doc", undefined, process.env);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch OpenAPI doc: ${res.status}\nBody: ${body}`);
  }
  const schema = await res.json() as {
    info?: Record<string, unknown>;
  };

  schema.info = {
    ...schema.info,
    [CLIENT_BINDINGS_OPENAPI_EXTENSION]: buildClientBindings(),
  };

  const outputPath = resolveOutputPath();

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
