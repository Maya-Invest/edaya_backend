import { ActorAssuranceLevel, createGuardianActorMetadata, createServiceStaffActorMetadata, createStaffActorMetadata, createStudentActorMetadata, createTeacherActorMetadata, hashApiKey, parseBearerApiKey, parseInteractiveActorKind, resolveInteractiveActorIdentity } from "@edaya/authorization";

import type { SchoolRepositories } from "@edaya/service";
import { randomUUID } from "node:crypto";


import type { AppBindings } from "@/http/types";
import type { Context } from "hono";
import type { DependencyModule } from "@/http/dependency-injection";
import type { IdentityClaims, IdentityClient } from "@maya-invest/edaya-identity-client";

export interface AuthSession {
  user: {
    id: string;
    email?: string | null;
    phone?: string | null;
    name?: string | null;
    emailVerified?: boolean | null;
  };
  session: {
    id?: string;
    createdAt: string | Date;
  };
}

export interface AuthenticatedSession {
  user: {
    id: string;
    email?: string;
    phone?: string;
    name?: string;
    emailVerified: boolean;
  };
  session: {
    id?: string;
    createdAt: Date;
    assuranceLevel: ActorAssuranceLevel;
  };
}

interface ActorIdentityContext {
  subjectId: string;
  requestId: string;
  sessionId?: string;
  authenticatedAt: Date;
  assuranceLevel: ActorAssuranceLevel;
  academicYearId?: string;
}

type ActorIdentity
  = | {
    kind: "staff";
    schoolId: string;
    staffMemberId: string;
    accountKind?: "human" | "service";
    requestId?: string;
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
  }
  | {
    kind: "teacher";
    schoolId: string;
    teacherId: string;
  };

type NormalizedAuthSession = AuthenticatedSession;

/** Interactive assurance tracks email verification; strong (2FA) is unused for now. */
export function resolveAssuranceFromEmailVerified(
  emailVerified: boolean | undefined | null,
): ActorAssuranceLevel {
  return emailVerified === true
    ? ActorAssuranceLevel.Verified
    : ActorAssuranceLevel.Standard;
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

  const emailVerified = input.user.emailVerified === true;

  return {
    user: {
      id: input.user.id,
      emailVerified,
      ...(typeof input.user.email === "string" && input.user.email.trim() !== ""
        ? { email: input.user.email.trim() }
        : {}),
      ...(typeof input.user.phone === "string" && input.user.phone.trim() !== ""
        ? { phone: input.user.phone.trim() }
        : {}),
      ...(typeof input.user.name === "string" && input.user.name.trim() !== ""
        ? { name: input.user.name.trim() }
        : {}),
    },
    session: {
      ...(input.session.id ? { id: input.session.id } : {}),
      createdAt: authenticatedAt,
      assuranceLevel: resolveAssuranceFromEmailVerified(emailVerified),
    },
  };
}

export async function resolveAuthenticatedSession(
  headers: Headers,
  identityClient: IdentityClient,
): Promise<AuthenticatedSession | null> {
  const authorization = headers.get("authorization");
  const apiKey = parseBearerApiKey(authorization ?? undefined);
  const token = resolveBearerToken(authorization);
  if (!token || apiKey) {
    return null;
  }
  try {
    const claims = await identityClient.verifyAccessToken(token);
    return sessionFromIdentityClaims(claims);
  }
  catch {
    return null;
  }
}

function resolveBearerToken(authorization: string | null): string | undefined {
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1];
}

function sessionFromIdentityClaims(claims: IdentityClaims): AuthenticatedSession {
  return {
    user: {
      id: claims.sub,
      emailVerified: claims.email_verified === true,
      ...(claims.email ? { email: claims.email } : {}),
      ...(claims.phone ? { phone: claims.phone } : {}),
    },
    session: {
      ...(claims.sid ? { id: claims.sid } : {}),
      createdAt: new Date(),
      assuranceLevel: resolveAssuranceFromEmailVerified(claims.email_verified),
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
  resolution: { actorKind?: ReturnType<typeof parseInteractiveActorKind>; schoolId?: string; actorId?: string },
): Promise<ActorIdentity | null> {
  const resolved = await resolveInteractiveActorIdentity(repos, { subjectId, ...resolution });
  if (!resolved) return null;
  switch (resolved.kind) {
    case "staff": return { kind: "staff", schoolId: resolved.schoolId, staffMemberId: resolved.actorId };
    case "guardian": return { kind: "guardian", schoolId: resolved.schoolId, guardianId: resolved.actorId };
    case "student": return { kind: "student", schoolId: resolved.schoolId, studentId: resolved.actorId };
    case "teacher": return { kind: "teacher", schoolId: resolved.schoolId, teacherId: resolved.actorId };
  }
}

async function resolveServiceActorIdentity(
  repos: SchoolRepositories,
  apiKey: string,
  requestId: string,
): Promise<Extract<ActorIdentity, { kind: "staff" }> | null> {
  const keyRecord = await repos.serviceApiKeys.findActiveByHash(hashApiKey(apiKey));
  if (!keyRecord) return null;
  const staffMember = await repos.staffMembers.findById(keyRecord.staffMemberId);
  if (!staffMember || staffMember.accountKind !== "service" || !staffMember.isActive
      || staffMember.schoolId !== keyRecord.schoolId) return null;
  return { kind: "staff", schoolId: staffMember.schoolId, staffMemberId: staffMember.id, accountKind: "service", requestId };
}

function createActorFromIdentity(identity: ActorIdentity, context: ActorIdentityContext) {
  switch (identity.kind) {
    case "staff":
      if (identity.accountKind === "service") {
        return createServiceStaffActorMetadata({
          ...context,
          schoolId: identity.schoolId,
          requestId: context.requestId,
          authenticatedAt: context.authenticatedAt,
          staffMemberId: identity.staffMemberId,
        });
      }
      return createStaffActorMetadata({
        ...context,
        schoolId: identity.schoolId,
        staffMemberId: identity.staffMemberId,
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
    case "teacher":
      return createTeacherActorMetadata({
        ...context,
        schoolId: identity.schoolId,
        teacherId: identity.teacherId,
      });
  }
}

function resolveActorIdHeader(headerValue: string | undefined): string | undefined {
  const trimmed = headerValue?.trim();
  return trimmed || undefined;
}

function resolveSchoolIdHeader(headerValue: string | undefined): string | undefined {
  const trimmed = headerValue?.trim();
  return trimmed || undefined;
}

function resolveAcademicYearId(headerValue: string | undefined): string | undefined {
  const trimmed = headerValue?.trim();
  return trimmed || undefined;
}

export function createSessionActorDependency(
  resolveIdentityClient?: (c: Context<AppBindings>) => Promise<IdentityClient> | IdentityClient,
): DependencyModule<AppBindings> {
  return {
    name: "sessionActor",
    async resolve(c) {
      const identityClient = resolveIdentityClient
        ? await resolveIdentityClient(c)
        : c.var.identityClient;
      const session = await resolveAuthenticatedSession(c.req.raw.headers, identityClient);

      const requestId = resolveRequestId(c.req.header("x-request-id"));
      const academicYearId = resolveAcademicYearId(c.req.header("x-academic-year-id"));
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
          {
            actorKind: parseInteractiveActorKind(c.req.header("x-actor-kind")),
            schoolId: resolveSchoolIdHeader(c.req.header("x-school-id")),
            actorId: resolveActorIdHeader(c.req.header("x-actor-id")),
          },
        );
        if (identity) {
          const interactiveContext = {
            subjectId: user.id,
            requestId,
            academicYearId,
            ...(session.session.id ? { sessionId: session.session.id } : {}),
            authenticatedAt: session.session.createdAt,
            assuranceLevel: session.session.assuranceLevel,
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
          requestId,
        );
        if (identity) {
          c.set("actor", createActorFromIdentity(identity, {
            subjectId: `service:${identity.staffMemberId}`,
            requestId,
            authenticatedAt: new Date(),
            academicYearId,
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
