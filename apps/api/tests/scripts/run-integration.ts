import { $ } from "bun";

const files = Array.from(new Bun.Glob("**/*.integration.test.ts").scanSync({ onlyFiles: true }))
  .filter(file => !file.split("/").some(part => part === "dist" || part === "node_modules"))
  .sort();
if (files.length === 0)
  throw new Error("No API integration test files found");

// Exiting each process releases its PGlite WASM allocations before the next file.
for (const file of files) {
  await $`bun test ${`./${file}`} --timeout 120000 --preload ../../tooling/test-support/preload.ts`;
}
