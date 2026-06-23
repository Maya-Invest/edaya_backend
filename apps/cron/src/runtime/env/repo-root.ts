import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolveRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
}

function isRepoLocalDataPath(pathValue: string): boolean {
  return pathValue === ".data" || pathValue.startsWith(".data/");
}

export function resolveRepoLocalDataPath(pathValue: string): string {
  if (path.isAbsolute(pathValue)) {
    return pathValue;
  }
  if (isRepoLocalDataPath(pathValue)) {
    return path.resolve(resolveRepoRoot(), pathValue);
  }
  return path.resolve(process.cwd(), pathValue);
}

export function resolveRepoLocalDatabaseUrl(databaseUrl: string): string {
  if (!databaseUrl.startsWith("pglite:")) {
    return databaseUrl;
  }
  const dataDir = databaseUrl.slice("pglite:".length).trim();
  if (!dataDir || path.isAbsolute(dataDir) || !isRepoLocalDataPath(dataDir)) {
    return databaseUrl;
  }
  return `pglite:${resolveRepoLocalDataPath(dataDir)}`;
}
