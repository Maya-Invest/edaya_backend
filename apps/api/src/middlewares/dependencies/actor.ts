import {
  ActorAssuranceLevel,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  createStudentActorMetadata,
} from "@edaya/core";
import type { DependencyModule } from "../dependencies-injection";

export interface AuthSessionProvider {
  api: {
    getSession: (args: { headers: Headers }) => Promise<any>;
  };
}

export type ResolveAuthSessionProvider = () => Promise<AuthSessionProvider> | AuthSessionProvider;

async function resolveDefaultAuthProvider() {
  const { auth } = await import("@/routes/auth/auth.config");
  return auth;
}

export function createSessionActorDependency(resolveAuth: ResolveAuthSessionProvider = resolveDefaultAuthProvider): DependencyModule {
  return {
    name: "sessionActor",
    async resolve(c) {
      const auth = await resolveAuth();
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });

      if (!session) {
        c.set("actor", null);
        return;
      }

      const { user } = session;
      const repos = c.var.schoolApp.repositories;
      const interactiveContext = {
        subjectId: user.id,
        schoolId: "school-default",
        requestId: c.req.header("x-request-id") || `req-${Math.random().toString(36).substr(2, 9)}`,
        authenticatedAt: new Date(session.session.createdAt),
        assuranceLevel: ActorAssuranceLevel.Standard,
      };

      const staff = await repos.staffMembers.findOne({ subjectId: user.id });
      if (staff) {
        c.set("actor", createStaffActorMetadata({
          ...interactiveContext,
          schoolId: staff.schoolId,
          staffMemberId: staff.id,
          roles: staff.roles,
        }));
        return;
      }

      const guardian = await repos.guardians.findOne({ subjectId: user.id });
      if (guardian) {
        c.set("actor", createGuardianActorMetadata({
          ...interactiveContext,
          schoolId: guardian.schoolId,
          guardianId: guardian.id,
        }));
        return;
      }

      const student = await repos.students.findOne({ subjectId: user.id });
      if (student) {
        c.set("actor", createStudentActorMetadata({
          ...interactiveContext,
          schoolId: student.schoolId,
          studentId: student.id,
        }));
        return;
      }

      c.set("actor", null);
    },
  };
}

export const sessionActorDependency = createSessionActorDependency();
