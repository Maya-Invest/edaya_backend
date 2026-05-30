import type { Context, MiddlewareHandler, Next } from "hono";
import { parseEnv } from "@/env";
import type { AppBindings } from "@/lib/types";
import { RepositoryAuthorizationPolicy, SchoolApplication } from "@edaya/core";
import { PostgresAtomicExecution, PostgresSchoolRepositories } from "@edaya/adaptor-postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

let schoolAppInstance: SchoolApplication | null = null;
let sqlClient: any = null;

export const dependenciesInjection: MiddlewareHandler<AppBindings> = async (c: Context<AppBindings>, next: Next) => {
  // Inject env
  // eslint-disable-next-line node/no-process-env
  const env = Object.assign(c.env || {}, process.env);
  c.env = parseEnv(env);

  if (!schoolAppInstance) {
    sqlClient = postgres(c.env.DATABASE_URL);
    const db = drizzle(sqlClient);
    const repos = new PostgresSchoolRepositories(db);

    // Bootstrap DB schema if not already initialized
    await repos.init();

    const atomicExecution = new PostgresAtomicExecution(db);

    // Initial system or placeholder actor configuration
    const systemActor = {
      kind: "system" as const,
      systemId: "api-server-bootstrap",
      schoolId: "system-bootstrap",
      requestId: "bootstrap-init",
      reason: "API Gateway Initialization",
    };

    schoolAppInstance = new SchoolApplication({
      atomicExecution,
      repositories: repos,
      authorizationPolicy: new RepositoryAuthorizationPolicy({
        repositories: repos,
        staffAssignmentRepository: repos.staffAssignments,
        staffMemberRepository: repos.staffMembers,
        guardianRepository: repos.guardians,
        guardianStudentLinkRepository: repos.guardianLinks,
        studentRepository: repos.students,
      }),
      actor: systemActor,
    });
  }

  c.set("schoolApp", schoolAppInstance);

  // Run next
  await next();
};
