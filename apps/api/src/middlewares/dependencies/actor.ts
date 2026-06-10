import {
  ActorAssuranceLevel,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  createStudentActorMetadata,
  type EffectiveGrants,
  type SchoolRepositories,
} from "@edaya/core";
import { randomUUID } from "node:crypto";
import { resolveCachedEffectiveGrants } from "@/lib/authorization-grants-cache";
import type { DependencyModule } from "../dependencies-injection";

export interface AuthSession {
  user: {
    id: string;
  };
  session: {
    id?: string;
    createdAt: string | Date;
    assuranceLevel?: ActorAssuranceLevel | string;
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
    effectiveGrants?: EffectiveGrants;
  }
  | {
    kind: "guardian";
    schoolId: string;
    guardianId: string;
    effectiveGrants?: EffectiveGrants;
  }
  | {
    kind: "student";
    schoolId: string;
    studentId: string;
    effectiveGrants?: EffectiveGrants;
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
    assuranceLevel: ActorAssuranceLevel;
  };
}

function normalizeAssuranceLevel(input: unknown): ActorAssuranceLevel {
  if (input === ActorAssuranceLevel.Verified || input === ActorAssuranceLevel.Strong) {
    return input;
  }
  return ActorAssuranceLevel.Standard;
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
      assuranceLevel: normalizeAssuranceLevel(input.session.assuranceLevel),
    },
  };
}

function resolveRequestId(headerValue: string | undefined): string {
  const trimmed = headerValue?.trim();
  return trimmed || randomUUID();
}

async function resolveActorIdentity(
  repos: SchoolRepositories,
  subjectId: string,
  session: NormalizedAuthSession["session"],
): Promise<ActorIdentity | null> {
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

  if (identities.length !== 1) {
    return null;
  }

  const [identity] = identities;
  if (!identity) {
    return null;
  }

  const actorId
    = identity.kind === "staff"
      ? identity.staffMemberId
      : identity.kind === "guardian"
        ? identity.guardianId
        : identity.studentId;

  const effectiveGrants = await resolveCachedEffectiveGrants({
    actorId,
    actorType: identity.kind,
    schoolId: identity.schoolId,
    subjectId,
    ...(session.id ? { sessionId: session.id } : {}),
    authenticatedAt: session.createdAt,
    repositories: repos,
  });

  return {
    ...identity,
    effectiveGrants,
  };
}

function createActorFromIdentity(identity: ActorIdentity, context: ActorIdentityContext) {
  switch (identity.kind) {
    case "staff":
      return createStaffActorMetadata({
        ...context,
        schoolId: identity.schoolId,
        staffMemberId: identity.staffMemberId,
        effectiveGrants: identity.effectiveGrants!,
      });
    case "guardian":
      return createGuardianActorMetadata({
        ...context,
        schoolId: identity.schoolId,
        guardianId: identity.guardianId,
        effectiveGrants: identity.effectiveGrants!,
      });
    case "student":
      return createStudentActorMetadata({
        ...context,
        schoolId: identity.schoolId,
        studentId: identity.studentId,
        effectiveGrants: identity.effectiveGrants!,
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
        assuranceLevel: session.session.assuranceLevel,
      };

      const identity = await resolveActorIdentity(repos, user.id, session.session);
      if (identity) {
        c.set("actor", createActorFromIdentity(identity, interactiveContext));
        return;
      }

      c.set("actor", null);
    },
  };
}

export const sessionActorDependency = createSessionActorDependency();
