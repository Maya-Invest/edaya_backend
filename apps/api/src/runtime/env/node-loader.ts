/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseRuntimeEnv } from "@/runtime/env/schema";
import type { Environment } from "@/runtime/env/schema";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

export function loadDotenvFiles(): void {
  expand(config({
    path: path.resolve(apiRoot, ".env"),
  }));
}

function shouldLoadDotenvFiles(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Load env for the Node.js runtime (local dev, tests, container). */
export function loadNodeProcessEnv(): Environment {
  if (shouldLoadDotenvFiles()) {
    loadDotenvFiles();
  }

  return parseRuntimeEnv(process.env, "node");
}
