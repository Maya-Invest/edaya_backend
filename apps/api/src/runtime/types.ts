import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { Environment } from "@/runtime/env/schema";

export type RuntimeKind = "node" | "worker";

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
  readonly db: unknown;
  readonly authDb: unknown;
  readonly sqlClient: unknown | null;
  getSchoolApplication: () => Promise<ApiSchoolApplication>;
  getAuth: () => AuthService;
  close: () => Promise<void>;
}
