import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { Environment } from "@/runtime/shared/env/schema";
import type { IdentityClient } from "../identity/server/index";

export type RuntimeKind = "in-memory" | "local" | "worker";

export type RuntimeBindings = Record<string, unknown>;

export interface DatabaseHandle {
  db: unknown;
  sqlClient: unknown | null;
  dispose: () => Promise<void>;
}

export interface ApiRuntime {
  getIdentityRuntime?: () => Promise<import("@/identity/runtime").IdentityRuntime>;
  drainNotifications?: () => Promise<void>;
  readonly env: Environment;
  getSchoolApplication: () => Promise<ApiSchoolApplication>;
  getIdentityClient: () => IdentityClient;
  close: () => Promise<void>;
}
