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
  $context?: Promise<{
    internalAdapter: {
      updateUser: (userId: string, data: { emailVerified?: boolean }) => Promise<unknown>;
      updateUserByEmail: (email: string, data: { emailVerified?: boolean }) => Promise<unknown>;
      findUserByEmail: (email: string) => Promise<{ id: string; emailVerified?: boolean } | null>;
    };
  }>;
}

export interface ApiRuntime {
  readonly env: Environment;
  getSchoolApplication: () => Promise<ApiSchoolApplication>;
  getAuth: () => AuthService;
  close: () => Promise<void>;
}
