import { ActorAssuranceLevel, bootstrapPlatformUserIfAbsent, createGuardianActorMetadata, createPlatformActorMetadata, createS2sActorMetadata, createServiceStaffActorMetadata, createStaffActorMetadata, createStudentActorMetadata, createTeacherActorMetadata, hashApiKey, parseBearerApiKey, parseBearerS2sKey, parseInteractiveActorKind, resolveInteractiveActorIdentity, subjectHasSchoolInteractiveIdentity } from "@edaya/authorization";
import type { EffectiveGrants, GuardianScope, StudentScope, TeacherActorScope } from "@edaya/authorization";
import type { SchoolRepositories } from "@edaya/service";
import { randomUUID } from "node:crypto";
import { resolveCachedEffectiveGrants, resolveGrantsCacheTtlMs } from "@/lib/authorization/grants-cache/resolve-cached";
import { resolveCachedActorScope } from "@/lib/authorization/scope-cache/resolve-cached";
import type { AppBindings } from "@/http/types";
import type { Context } from "hono";
import type { DependencyModule } from "@/http/dependency-injection";
import type { IdentityClaims, IdentityClient } from "@maya-invest/edaya-identity-client";
import { platformBootstrapEmails } from "@/runtime/shared/env/derived";

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
}

type ActorIdentity
  = | {
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
    guardianScope?: GuardianScope;
  }
  | {
    kind: "student";
    schoolId: string;
    studentId: string;
    studentScope?: StudentScope;
  }
  | {
    kind: "teacher";
    schoolId: string;
    teacherId: string;
    teacherScope?: TeacherActorScope;
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
  const s2sKey = parseBearerS2sKey(authorization ?? undefined);
  const token = resolveBearerToken(authorization);
  if (!token || apiKey || s2sKey) {
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
  session: NormalizedAuthSession["session"],
  academicYearId: string | undefined,
  ttlMs: number,
  resolution: {
    actorKind?: ReturnType<typeof parseInteractiveActorKind>;
    schoolId?: string;
    actorId?: string;
  },
): Promise<ActorIdentity | null> {
  const resolved = await resolveInteractiveActorIdentity(repos, {
    subjectId,
    ...(resolution.actorKind ? { actorKind: resolution.actorKind } : {}),
    ...(resolution.schoolId ? { schoolId: resolution.schoolId } : {}),
    ...(resolution.actorId ? { actorId: resolution.actorId } : {}),
  });

  if (!resolved) {
    return null;
  }

  const identity: ActorIdentity = resolved.kind === "staff"
    ? {
        kind: "staff",
        schoolId: resolved.schoolId,
        staffMemberId: resolved.actorId,
      }
    : resolved.kind === "guardian"
      ? {
          kind: "guardian",
          schoolId: resolved.schoolId,
          guardianId: resolved.actorId,
        }
      : resolved.kind === "student"
        ? {
            kind: "student",
            schoolId: resolved.schoolId,
            studentId: resolved.actorId,
          }
        : {
            kind: "teacher",
            schoolId: resolved.schoolId,
            teacherId: resolved.actorId,
          };

  try {
    if (resolved.kind === "staff") {
      const effectiveGrants = await resolveCachedEffectiveGrants({
        actorId: resolved.actorId,
        actorType: resolved.kind,
        schoolId: resolved.schoolId,
        ...(academicYearId ? { academicYearId } : {}),
        subjectId,
        ...(session.id ? { sessionId: session.id } : {}),
        authenticatedAt: session.createdAt,
        repositories: repos,
        ttlMs,
      });

      return {
        ...identity,
        effectiveGrants,
      } as ActorIdentity;
    }

    const scope = await resolveCachedActorScope({
      actorId: resolved.actorId,
      actorKind: resolved.kind,
      schoolId: resolved.schoolId,
      ...(academicYearId ? { academicYearId } : {}),
      subjectId,
      ...(session.id ? { sessionId: session.id } : {}),
      authenticatedAt: session.createdAt,
      repositories: repos,
      ttlMs,
    });

    if (resolved.kind === "guardian") {
      return {
        kind: "guardian",
        schoolId: resolved.schoolId,
        guardianId: resolved.actorId,
        guardianScope: scope as GuardianScope,
      };
    }

    if (resolved.kind === "student") {
      return {
        kind: "student",
        schoolId: resolved.schoolId,
        studentId: resolved.actorId,
        studentScope: scope as StudentScope,
      };
    }

    return {
      kind: "teacher",
      schoolId: resolved.schoolId,
      teacherId: resolved.actorId,
      teacherScope: scope as TeacherActorScope,
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
        guardianScope: identity.guardianScope!,
      });
    case "student":
      return createStudentActorMetadata({
        ...context,
        schoolId: identity.schoolId,
        studentId: identity.studentId,
        studentScope: identity.studentScope!,
      });
    case "teacher":
      return createTeacherActorMetadata({
        ...context,
        schoolId: identity.schoolId,
        teacherId: identity.teacherId,
        teacherScope: identity.teacherScope!,
      });
  }
}

async function resolvePlatformActorMetadata(
  repos: SchoolRepositories,
  user: AuthenticatedSession["user"],
  context: ActorIdentityContext,
  bootstrapEmails: readonly string[],
) {
  const existing = await repos.platformUsers.findBySubjectId(user.id);
  if (existing) {
    if (!existing.isActive) {
      return null;
    }
    return createPlatformActorMetadata({
      ...context,
      actorId: existing.id,
      permissions: existing.permissions,
      email: existing.email,
    });
  }

  const email = user.email?.trim().toLowerCase();
  if (!email || !bootstrapEmails.includes(email)) {
    return null;
  }

  const bootstrapped = await bootstrapPlatformUserIfAbsent(repos.platformUsers, {
    subjectId: user.id,
    email,
  });
  if (!bootstrapped) {
    return null;
  }

  return createPlatformActorMetadata({
    ...context,
    actorId: bootstrapped.id,
    permissions: bootstrapped.permissions,
    email: bootstrapped.email,
  });
}

async function resolveS2sActor(
  repos: SchoolRepositories,
  apiKey: string,
  requestId: string,
) {
  const keyRecord = await repos.s2sClients.findActiveByHash(hashApiKey(apiKey));
  if (!keyRecord) {
    return null;
  }

  return createS2sActorMetadata({
    actorId: keyRecord.id,
    schoolId: keyRecord.schoolId,
    requestId,
    clientId: keyRecord.clientId,
    accessClass: keyRecord.accessClass,
  });
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
      const ttlMs = resolveGrantsCacheTtlMs(c.env);
      const repos = c.var.schoolApp.repositories;
      const bearerApiKey = parseBearerApiKey(c.req.header("authorization"));
      const bearerS2sKey = parseBearerS2sKey(c.req.header("authorization"));

      if (session && (bearerApiKey || bearerS2sKey)) {
        c.set("actor", null);
        return;
      }

      if (session) {
        const { user } = session;
        const actorKind = parseInteractiveActorKind(c.req.header("x-actor-kind"));
        const interactiveContext = {
          subjectId: user.id,
          requestId,
          ...(session.session.id ? { sessionId: session.session.id } : {}),
          authenticatedAt: session.session.createdAt,
          assuranceLevel: session.session.assuranceLevel,
        };
        const bootstrapEmails = platformBootstrapEmails(c.env);

        if (actorKind === "platform") {
          c.set("actor", await resolvePlatformActorMetadata(repos, user, interactiveContext, bootstrapEmails));
          return;
        }

        const identity = await resolveActorIdentity(
          repos,
          user.id,
          session.session,
          academicYearId,
          ttlMs,
          {
            actorKind,
            schoolId: resolveSchoolIdHeader(c.req.header("x-school-id")),
            actorId: resolveActorIdHeader(c.req.header("x-actor-id")),
          },
        );
        if (identity) {
          c.set("actor", createActorFromIdentity(identity, interactiveContext));
          return;
        }

        if (!actorKind && !(await subjectHasSchoolInteractiveIdentity(repos, user.id))) {
          c.set("actor", await resolvePlatformActorMetadata(repos, user, interactiveContext, bootstrapEmails));
          return;
        }

        c.set("actor", null);
        return;
      }

      if (bearerS2sKey) {
        c.set("actor", await resolveS2sActor(repos, bearerS2sKey, requestId));
        return;
      }

      if (bearerApiKey) {
        const identity = await resolveServiceActorIdentity(
          repos,
          bearerApiKey,
          academicYearId,
          ttlMs,
          requestId,
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
