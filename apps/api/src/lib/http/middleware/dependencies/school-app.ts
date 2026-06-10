import { db } from "@/lib/bootstrap/db";
import { ApiSchoolApplication } from "@/lib/school-api/runtime/school-application";
import { PostgresAtomicExecution, PostgresSchoolRepositories } from "@edaya/adaptor-postgres";
import {
  createRepositoryAuthorizationPolicy,
} from "@edaya/core";
import type { DependencyModule } from "../dependencies";

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
          authorizationPolicy: createRepositoryAuthorizationPolicy({
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
