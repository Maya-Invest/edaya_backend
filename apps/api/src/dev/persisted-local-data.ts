/* eslint-disable node/no-process-env */
import path from "node:path";
import type { Environment } from "@/runtime/shared/env/schema";
import { resolveRepoLocalDataPath } from "@/runtime/shared/env/repo-root";

function usesRepoLocalDataPath(pathValue: string): boolean {
  if (pathValue === ".data" || pathValue.startsWith(".data/")) {
    return true;
  }

  const repoDataRoot = resolveRepoLocalDataPath(".data");
  const normalized = path.normalize(pathValue);
  return normalized.startsWith(`${repoDataRoot}${path.sep}`)
    || normalized.includes(`${path.sep}.data${path.sep}`)
    || normalized.endsWith(`${path.sep}.data`);
}

/** True when the API uses persisted PGlite under repo-root `.data/`. */
export function isPersistedLocalDataDeployment(
  env: Pick<Environment, "RUNTIME" | "DATABASE_URL">,
): boolean {
  if (env.RUNTIME !== "local") {
    return false;
  }

  if (!env.DATABASE_URL.startsWith("pglite:")) {
    return false;
  }

  const schoolDataDir = env.DATABASE_URL.slice("pglite:".length).trim();
  return Boolean(schoolDataDir && schoolDataDir !== "pglite" && usesRepoLocalDataPath(schoolDataDir));
}

export function resolveSeedOnStart(
  env: Pick<Environment, "NODE_ENV" | "RUNTIME" | "DATABASE_URL">,
): boolean {
  const raw = process.env.SEED_ON_START?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") {
    return false;
  }
  if (raw === "true" || raw === "1" || raw === "yes") {
    return isPersistedLocalDataDeployment(env);
  }

  return env.NODE_ENV === "development" && isPersistedLocalDataDeployment(env);
}
