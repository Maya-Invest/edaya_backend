import type { RuntimeBindings, RuntimeKind } from "@edaya/adaptor-cloudflare";
import type { Environment } from "@/lib/runtime/env";
import type { ApiSchoolApplication } from "@/lib/school-api/application";

export type { RuntimeBindings, RuntimeKind };

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
