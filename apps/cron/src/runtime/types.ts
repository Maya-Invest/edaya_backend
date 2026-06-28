import type { SchoolApplication } from "@edaya/core";
import type { Environment } from "@/runtime/shared/env/schema";

export type RuntimeKind = "local" | "worker";

export type RuntimeBindings = Record<string, unknown>;

export interface DatabaseHandle {
  db: unknown;
  sqlClient: unknown | null;
  dispose: () => Promise<void>;
}

export interface CronRuntime {
  readonly env: Environment;
  getSchoolApplication: () => Promise<SchoolApplication>;
  close: () => Promise<void>;
}
