import type { Environment } from "@/lib/bootstrap/env";
import type { ApiSchoolApplication } from "@/lib/school-api/runtime/school-application";

export type RuntimeKind = Environment["RUNTIME"];

export type RuntimeBindings = Record<string, unknown>;

export interface AuthService {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (args: { headers: Headers }) => Promise<unknown>;
  };
}

export interface ApiRuntime {
  readonly env: Environment;
  readonly db: unknown;
  readonly sqlClient: unknown | null;
  getSchoolApplication: () => Promise<ApiSchoolApplication>;
  getAuth: () => AuthService;
  close: () => Promise<void>;
}
