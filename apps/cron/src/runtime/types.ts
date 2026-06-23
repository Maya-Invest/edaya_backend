import type { SchoolApplication } from "@edaya/core";
import type { Environment } from "@/runtime/env/schema";

export type RuntimeKind = "node" | "worker";

export type RuntimeBindings = Record<string, unknown>;

export interface DatabaseHandle {
  db: unknown;
  sqlClient: unknown | null;
  dispose: () => Promise<void>;
}

export interface CronRuntime {
  readonly env: Environment;
  readonly db: unknown;
  readonly sqlClient: unknown | null;
  getSchoolApplication: () => Promise<SchoolApplication>;
  close: () => Promise<void>;
}
