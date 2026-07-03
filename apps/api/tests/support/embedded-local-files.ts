import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalFileStorageApp } from "@edaya/adaptor-local-fs";
import type { Environment } from "@/runtime/shared/env/schema";
import { createPgliteTestEnv } from "./pglite-env";

export interface EmbeddedLocalFilesServer {
  baseUrl: string;
  rootDir: string;
  dataRoot: string;
  stop: () => void;
}

export function startEmbeddedLocalFilesServer(
  secret: string,
): EmbeddedLocalFilesServer {
  const dataRoot = mkdtempSync(join(tmpdir(), "edaya-embedded-local-files-"));
  const rootDir = join(dataRoot, "files");
  const app = createLocalFileStorageApp({
    baseUrl: "http://127.0.0.1",
    rootDir,
    secret,
    allowedOrigins: ["*"],
  });
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: app.fetch,
  });

  return {
    baseUrl: `http://127.0.0.1:${server.port}`,
    rootDir,
    dataRoot,
    stop: () => {
      server.stop();
      rmSync(dataRoot, { recursive: true, force: true });
    },
  };
}

export function createLocalProfileTestEnv(
  localFiles: EmbeddedLocalFilesServer,
  overrides: Record<string, unknown> = {},
): Environment {
  return createPgliteTestEnv({
    RUNTIME: "local",
    DATABASE_URL: `pglite:${join(localFiles.dataRoot, "school")}`,
    LOCAL_FILES_URL: localFiles.baseUrl,
    LOCAL_FILES_ROOT: localFiles.rootDir,
    LOG_LEVEL: "silent",
    ...overrides,
  });
}
