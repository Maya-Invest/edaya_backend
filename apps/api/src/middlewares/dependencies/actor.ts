import {
  ActorAssuranceLevel,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  createStudentActorMetadata,
  type SchoolRepositories,
  type StaffRole,
} from "@edaya/core";
import { randomUUID } from "node:crypto";
import type { DependencyModule } from "../dependencies-injection";

export interface AuthSession {
  user: {
    id: string;
  };
  session: {
    id?: string;
    createdAt: string | Date;
  };
}

export interface AuthSessionProvider {
  api: {
    getSession: (args: { headers: Headers }) => Promise<AuthSession | null | undefined>;
  };
}

export type ResolveAuthSessionProvider = () => Promise<AuthSessionProvider> | AuthSessionProvider;

interface ActorIdentityContext {
  subjectId: string;
  requestId: string;
  sessionId?: string;
  authenticatedAt: Date;
  assuranceLevel: ActorAssuranceLevel;
}

type ActorIdentity =
  | {
    kind: "staff";
    schoolId: string;
    staffMemberId: string;
    roles: readonly StaffRole[];
  }
  | {
    kind: "guardian";
    schoolId: string;
    guardianId: string;
  }
  | {
    kind: "student";
    schoolId: string;
    studentId: string;
  };

async function resolveDefaultAuthProvider() {
  const { auth } = await import("@/routes/auth/auth.config");
  return auth;
}

interface NormalizedAuthSession {
  user: {
    id: string;
  };
  session: {
    id?: string;
    createdAt: Date;
  };
}

function normalizeAuthSession(input: AuthSession | null | undefined): NormalizedAuthSession | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  if (!input.user || typeof input.user.id !== "string" || input.user.id.trim() === "") {
    return null;
  }

  if (!input.session || !("createdAt" in input.session)) {
    return null;
  }

  const authenticatedAt = new Date(input.session.createdAt);
  if (Number.isNaN(authenticatedAt.getTime())) {
    return null;
  }

  return {
    user: {
      id: input.user.id,
    },
    session: {
      ...(input.session.id ? { id: input.session.id } : {}),
      createdAt: authenticatedAt,
    },
  };
}

function resolveRequestId(headerValue: string | undefined): string {
  const trimmed = headerValue?.trim();
  return trimmed || randomUUID();
}

async function resolveActorIdentity(repos: SchoolRepositories, subjectId: string): Promise<ActorIdentity | null> {
  const [staff, guardian, student] = await Promise.all([
    repos.staffMembers.findOne({ subjectId }),
    repos.guardians.findOne({ subjectId }),
    repos.students.findOne({ subjectId }),
  ]);

  const identities: ActorIdentity[] = [];

  if (staff) {
    identities.push({
      kind: "staff",
      schoolId: staff.schoolId,
      staffMemberId: staff.id,
      roles: staff.roles,
    });
  }

  if (guardian) {
    identities.push({
      kind: "guardian",
      schoolId: guardian.schoolId,
      guardianId: guardian.id,
    });
  }

  if (student) {
    identities.push({
      kind: "student",
      schoolId: student.schoolId,
      studentId: student.id,
    });
  }

  return identities.length === 1 ? identities[0] : null;
}

function createActorFromIdentity(identity: ActorIdentity, context: ActorIdentityContext) {
  switch (identity.kind) {
    case "staff":
      return createStaffActorMetadata({
        ...context,
        schoolId: identity.schoolId,
        staffMemberId: identity.staffMemberId,
        roles: identity.roles,
      });
    case "guardian":
      return createGuardianActorMetadata({
        ...context,
        schoolId: identity.schoolId,
        guardianId: identity.guardianId,
      });
    case "student":
      return createStudentActorMetadata({
        ...context,
        schoolId: identity.schoolId,
        studentId: identity.studentId,
      });
  }
}

export function createSessionActorDependency(resolveAuth: ResolveAuthSessionProvider = resolveDefaultAuthProvider): DependencyModule {
  return {
    name: "sessionActor",
    async resolve(c) {
      const auth = await resolveAuth();
      const session = normalizeAuthSession(await auth.api.getSession({
        headers: c.req.raw.headers,
      }));

      if (!session) {
        c.set("actor", null);
        return;
      }

      const { user } = session;
      const repos = c.var.schoolApp.repositories;
      const interactiveContext = {
        subjectId: user.id,
        requestId: resolveRequestId(c.req.header("x-request-id")),
        ...(session.session.id ? { sessionId: session.session.id } : {}),
        authenticatedAt: session.session.createdAt,
        assuranceLevel: ActorAssuranceLevel.Standard,
      };

      const identity = await resolveActorIdentity(repos, user.id);
      if (identity) {
        c.set("actor", createActorFromIdentity(identity, interactiveContext));
        return;
      }

      c.set("actor", null);
    },
  };
}

export const sessionActorDependency = createSessionActorDependency();
