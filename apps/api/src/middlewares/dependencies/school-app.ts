import { db } from "@/db";
import { PostgresAtomicExecution, PostgresSchoolRepositories } from "@edaya/adaptor-postgres";
import {
  RepositoryAuthorizationPolicy,
  SchoolApplication,
} from "@edaya/core";
import type { DependencyModule } from "../dependencies-injection";

export function createSchoolAppDependency(): DependencyModule {
  let schoolAppInstance: SchoolApplication | null = null;

  return {
    name: "schoolApp",
    async resolve(c) {
      if (!schoolAppInstance) {
        const repos = new PostgresSchoolRepositories(db);
        await repos.init();

        const atomicExecution = new PostgresAtomicExecution(db);
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
    },
  };
}
