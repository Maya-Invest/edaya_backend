import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { Environment } from "@/runtime/shared/env/schema";

export type RuntimeKind = "in-memory" | "local" | "worker";

export type RuntimeBindings = Record<string, unknown>;

export interface DatabaseHandle {
  db: unknown;
  sqlClient: unknown | null;
  dispose: () => Promise<void>;
}

export interface AuthService {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (args: { headers: Headers }) => Promise<unknown>;
  };
}

export interface ApiRuntime {
  readonly env: Environment;
  getSchoolApplication: () => Promise<ApiSchoolApplication>;
  getAuth: () => AuthService;
  close: () => Promise<void>;
}
