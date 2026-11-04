import type { SchoolRepositories } from "@edaya/service";
import type { IdentityClaims, IdentityClient } from "../../identity/server/index";
import type { Context } from "hono";

import type { DependencyModule } from "@/http/dependency-injection";
import type { AppBindings } from "@/http/types";

import { randomUUID } from "node:crypto";
import { ActorAssuranceLevel, bootstrapPlatformUserIfAbsent, createGuardianActorMetadata, createPlatformActorMetadata, createS2sActorMetadata, createServiceStaffActorMetadata, createStaffActorMetadata, createStudentActorMetadata, createTeacherActorMetadata, hashApiKey, parseBearerApiKey, parseBearerS2sKey, parseInteractiveActorKind, resolveInteractiveActorIdentity, subjectHasSchoolInteractiveIdentity } from "@edaya/authorization";
import { HTTPException } from "hono/http-exception";
import { accountRequiresPrivilegedTotp } from "@/lib/account-security-policy";
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
  teacherScope?: IdentityClaims["teacherScope"];
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
  allowTeacherScope = false,
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
    if (claims.teacherScope && !allowTeacherScope) return null;
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
    teacherScope: claims.teacherScope,
    user: {
      id: claims.sub,
      emailVerified: claims.email_verified === true,
      ...(claims.email ? { email: claims.email } : {}),
      ...(claims.phone ? { phone: claims.phone } : {}),
    },
    session: {
      ...(claims.sid ? { id: claims.sid } : {}),
      createdAt: new Date((claims.auth_time ?? 0) * 1000),
      assuranceLevel: claims.amr?.includes("totp") && claims.mfa_time !== undefined ? ActorAssuranceLevel.Strong : (claims.email_verified || claims.phone_verified) ? ActorAssuranceLevel.Verified : ActorAssuranceLevel.Standard,
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
  if (!resolved)
    return null;
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
  if (!keyRecord)
    return null;
  const staffMember = await repos.staffMembers.findById(keyRecord.staffMemberId);
  if (!staffMember || staffMember.accountKind !== "service" || !staffMember.isActive
    || staffMember.schoolId !== keyRecord.schoolId) {
    return null;
  }
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

      email: existing.email,
    });
  }

  const email = user.email?.trim().toLowerCase();
  if (!user.emailVerified || !email || !bootstrapEmails.includes(email)) {
    return null;
  }

  const bootstrapped = await bootstrapPlatformUserIfAbsent(repos.platformUsers, {
    subjectId: user.id,
    email,
    emailVerified: user.emailVerified,
  });
  if (!bootstrapped) {
    return null;
  }

  return createPlatformActorMetadata({
    ...context,
    actorId: bootstrapped.id,

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
      const session = await resolveAuthenticatedSession(c.req.raw.headers, identityClient, true);

      const requestId = resolveRequestId(c.req.header("x-request-id"));
      const academicYearId = resolveAcademicYearId(c.req.header("x-academic-year-id"));
      const repos = c.var.schoolApp.repositories;
      const bearerApiKey = parseBearerApiKey(c.req.header("authorization"));
      const bearerS2sKey = parseBearerS2sKey(c.req.header("authorization"));

      if (session && (bearerApiKey || bearerS2sKey)) {
        c.set("actor", null);
        return;
      }

      if (session) {
        const { user } = session;
        if (c.env?.REQUIRE_PRIVILEGED_TOTP === true && session.session.assuranceLevel !== ActorAssuranceLevel.Strong
          && (await accountRequiresPrivilegedTotp(repos, user.id)
            || (user.emailVerified && platformBootstrapEmails(c.env).includes(user.email?.toLowerCase() ?? "")))) {
          throw new HTTPException(403, { message: "Authenticator enrollment or reauthentication required" });
        }
        const actorKind = parseInteractiveActorKind(c.req.header("x-actor-kind"));
        const interactiveContext = {
          subjectId: user.id,
          requestId,
          academicYearId,
          ...(session.session.id ? { sessionId: session.session.id } : {}),
          authenticatedAt: session.session.createdAt,
          assuranceLevel: session.session.assuranceLevel,
        };
        const bootstrapEmails = platformBootstrapEmails(c.env);

        if (session.teacherScope) {
          const { schoolId, teacherId } = session.teacherScope;
          const teacher = await repos.teachers.findById(teacherId);
          if (!teacher?.isActive || teacher.schoolId !== schoolId || teacher.subjectId !== user.id
            || (actorKind && actorKind !== "teacher") || (c.req.header("x-school-id") && c.req.header("x-school-id") !== schoolId)
            || (c.req.header("x-actor-id") && c.req.header("x-actor-id") !== teacherId)
            || (academicYearId && (await repos.academicYears.findById(academicYearId))?.schoolId !== schoolId))
            throw new HTTPException(403);
          c.set("actor", createTeacherActorMetadata({ ...interactiveContext, teacherId, schoolId }));
          return;
        }
        if (actorKind === "platform") {
          c.set("actor", await resolvePlatformActorMetadata(repos, user, interactiveContext, bootstrapEmails));
          return;
        }

        const identity = await resolveActorIdentity(
          repos,
          user.id,
          {
            actorKind,
            schoolId: resolveSchoolIdHeader(c.req.header("x-school-id")),
            actorId: resolveActorIdHeader(c.req.header("x-actor-id")),
          },
        );
        if (identity) {
          if (academicYearId && (await repos.academicYears.findById(academicYearId))?.schoolId !== identity.schoolId) {
            c.set("actor", null);
            return;
          }
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
          requestId,
        );
        if (identity) {
          if (academicYearId && (await repos.academicYears.findById(academicYearId))?.schoolId !== identity.schoolId) {
            c.set("actor", null);
            return;
          }
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
