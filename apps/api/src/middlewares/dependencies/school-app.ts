import { db } from "@/db";
import { ApiSchoolApplication } from "@/lib/school-service-facade";
import { PostgresAtomicExecution, PostgresSchoolRepositories } from "@edaya/adaptor-postgres";
import {
  RepositoryAuthorizationPolicy,
} from "@edaya/core";
import type { DependencyModule } from "../dependencies-injection";

export function createSchoolAppDependency(): DependencyModule {
  let schoolAppInstance: ApiSchoolApplication | null = null;

  return {
    name: "schoolApp",
    async resolve(c) {
      if (!schoolAppInstance) {
        const repos = new PostgresSchoolRepositories(db);
        await repos.init();

        const atomicExecution = new PostgresAtomicExecution(db);
        schoolAppInstance = new ApiSchoolApplication({
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
        });
      }

      c.set("schoolApp", schoolAppInstance);
    },
  };
}
