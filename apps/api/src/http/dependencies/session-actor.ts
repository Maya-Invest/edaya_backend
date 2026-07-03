import {
  createGuardianActorMetadata,
  createServiceStaffActorMetadata,
  createStaffActorMetadata,
  createStudentActorMetadata,
  type EffectiveGrants,
  hashApiKey,
  parseBearerApiKey,
  type SchoolRepositories,
} from "@edaya/core";
import { randomUUID } from "node:crypto";
import { resolveCachedEffectiveGrants, resolveGrantsCacheTtlMs, useStaffPermissionAssignmentsFromEnv } from "@/lib/authorization/grants-cache/resolve-cached";
import type { AppBindings } from "@/http/types";
import type { Context } from "hono";
import type { DependencyModule } from "@/http/dependency-injection";
import { isBetterAuthPath } from "./utils";
import { ActorAssuranceLevel } from "@edaya/core";

export interface AuthSession {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
  };
  session: {
    id?: string;
    createdAt: string | Date;
    assuranceLevel?: ActorAssuranceLevel | string;
  };
}

export interface AuthenticatedSession {
  user: {
    id: string;
    email?: string;
    name?: string;
  };
  session: {
    id?: string;
    createdAt: Date;
    assuranceLevel: ActorAssuranceLevel;
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
    accountKind?: "human" | "service";
    requestId?: string;
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

type NormalizedAuthSession = AuthenticatedSession;

function normalizeAssuranceLevel(input: unknown): ActorAssuranceLevel {
  if (input === ActorAssuranceLevel.Verified || input === ActorAssuranceLevel.Strong) {
    return input;
  }
  return ActorAssuranceLevel.Standard;
}

export function normalizeAuthSession(input: AuthSession | null | undefined): AuthenticatedSession | null {
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
      ...(typeof input.user.email === "string" && input.user.email.trim() !== ""
        ? { email: input.user.email.trim() }
        : {}),
      ...(typeof input.user.name === "string" && input.user.name.trim() !== ""
        ? { name: input.user.name.trim() }
        : {}),
    },
    session: {
      ...(input.session.id ? { id: input.session.id } : {}),
      createdAt: authenticatedAt,
      assuranceLevel: normalizeAssuranceLevel(input.session.assuranceLevel),
    },
  };
}

export async function resolveAuthenticatedSession(
  auth: AuthSessionProvider,
  headers: Headers,
): Promise<AuthenticatedSession | null> {
  const session = await auth.api.getSession({ headers });
  return normalizeAuthSession(session as AuthSession | null | undefined);
}

function resolveRequestId(headerValue: string | undefined): string {
  const trimmed = headerValue?.trim();
  return trimmed || randomUUID();
}

async function resolveActorIdentity(
  repos: SchoolRepositories,
  subjectId: string,
  session: NormalizedAuthSession["session"],
  academicYearId: string | undefined,
  ttlMs: number,
  useStaffPermissionAssignments: boolean,
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

  try {
    const effectiveGrants = await resolveCachedEffectiveGrants({
      actorId,
      actorType: identity.kind,
      schoolId: identity.schoolId,
      ...(academicYearId ? { academicYearId } : {}),
      subjectId,
      ...(session.id ? { sessionId: session.id } : {}),
      authenticatedAt: session.createdAt,
      repositories: repos,
      ttlMs,
      useStaffPermissionAssignments,
    });

    return {
      ...identity,
      effectiveGrants,
    };
  }
  catch {
    return null;
  }
}

async function resolveServiceActorIdentity(
  repos: SchoolRepositories,
  apiKey: string,
  academicYearId: string | undefined,
  ttlMs: number,
  requestId: string,
  useStaffPermissionAssignments: boolean,
): Promise<Extract<ActorIdentity, { kind: "staff" }> | null> {
  const keyRecord = await repos.serviceApiKeys.findActiveByHash(hashApiKey(apiKey));
  if (!keyRecord) {
    return null;
  }

  const staffMember = await repos.staffMembers.findById(keyRecord.staffMemberId);
  if (!staffMember || staffMember.accountKind !== "service" || !staffMember.isActive) {
    return null;
  }

  try {
    const effectiveGrants = await resolveCachedEffectiveGrants({
      actorId: staffMember.id,
      actorType: "staff",
      schoolId: staffMember.schoolId,
      ...(academicYearId ? { academicYearId } : {}),
      subjectId: `service:${staffMember.id}`,
      authenticatedAt: new Date(),
      repositories: repos,
      ttlMs,
      useStaffPermissionAssignments,
    });

    return {
      kind: "staff",
      schoolId: staffMember.schoolId,
      staffMemberId: staffMember.id,
      effectiveGrants,
      accountKind: "service" as const,
      requestId,
    };
  }
  catch {
    return null;
  }
}

function createActorFromIdentity(identity: ActorIdentity, context: ActorIdentityContext) {
  switch (identity.kind) {
    case "staff":
      if (identity.accountKind === "service") {
        return createServiceStaffActorMetadata({
          subjectId: context.subjectId,
          schoolId: identity.schoolId,
          requestId: context.requestId,
          authenticatedAt: context.authenticatedAt,
          staffMemberId: identity.staffMemberId,
          effectiveGrants: identity.effectiveGrants!,
        });
      }
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

function resolveAcademicYearId(headerValue: string | undefined): string | undefined {
  const trimmed = headerValue?.trim();
  return trimmed || undefined;
}

/**
 * Finance and other sensitive writes require `verified` assurance.
 * Dev sign-in uses `standard` until step-up auth exists; elevate school owners locally.
 */
function resolveInteractiveAssuranceLevel(
  assuranceLevel: ActorAssuranceLevel,
  identity: ActorIdentity,
  isDevelopment: boolean,
): ActorAssuranceLevel {
  if (
    isDevelopment
    && identity.kind === "staff"
    && identity.effectiveGrants?.isElevated
    && assuranceLevel === ActorAssuranceLevel.Standard
  ) {
    return ActorAssuranceLevel.Verified;
  }
  return assuranceLevel;
}

export function createSessionActorDependency(
  resolveAuth?: (c: Context<AppBindings>) => Promise<AuthSessionProvider> | AuthSessionProvider,
): DependencyModule<AppBindings> {
  return {
    name: "sessionActor",
    async resolve(c) {
      if (isBetterAuthPath(c)) {
        c.set("actor", null);
        return;
      }

      const auth = resolveAuth ? await resolveAuth(c) : c.var.auth;
      const session = normalizeAuthSession(await auth.api.getSession({
        headers: c.req.raw.headers,
      }) as AuthSession | null | undefined);

      const requestId = resolveRequestId(c.req.header("x-request-id"));
      const academicYearId = resolveAcademicYearId(c.req.header("x-academic-year-id"));
      const ttlMs = resolveGrantsCacheTtlMs(c.env);
      const useStaffPermissionAssignments = useStaffPermissionAssignmentsFromEnv(c.env);
      const repos = c.var.schoolApp.repositories;
      const bearerApiKey = parseBearerApiKey(c.req.header("authorization"));

      if (session && bearerApiKey) {
        c.set("actor", null);
        return;
      }

      if (session) {
        const { user } = session;

        const identity = await resolveActorIdentity(
          repos,
          user.id,
          session.session,
          academicYearId,
          ttlMs,
          useStaffPermissionAssignments,
        );
        if (identity) {
          const interactiveContext = {
            subjectId: user.id,
            requestId,
            ...(session.session.id ? { sessionId: session.session.id } : {}),
            authenticatedAt: session.session.createdAt,
            assuranceLevel: resolveInteractiveAssuranceLevel(
              session.session.assuranceLevel,
              identity,
              c.env?.NODE_ENV !== "production",
            ),
          };
          c.set("actor", createActorFromIdentity(identity, interactiveContext));
          return;
        }

        c.set("actor", null);
        return;
      }

      if (bearerApiKey) {
        const identity = await resolveServiceActorIdentity(
          repos,
          bearerApiKey,
          academicYearId,
          ttlMs,
          requestId,
          useStaffPermissionAssignments,
        );
        if (identity) {
          c.set("actor", createActorFromIdentity(identity, {
            subjectId: `service:${identity.staffMemberId}`,
            requestId,
            authenticatedAt: new Date(),
            assuranceLevel: ActorAssuranceLevel.Service,
          }));
          return;
        }
      }

      c.set("actor", null);
    },
  };
}

export const sessionActorDependency = createSessionActorDependency();
