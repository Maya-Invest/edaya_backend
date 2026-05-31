import type { Context, MiddlewareHandler, Next } from "hono";
import { auth } from "@/auth";
import { ActorAssuranceLevel, createGuardianActorMetadata, createStaffActorMetadata, createStudentActorMetadata } from "@edaya/core";

export const resolveSessionActor: MiddlewareHandler = async (c: Context, next: Next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    c.set("actor", null);
    await next();
    return;
  }

  const { user } = session;
  const repos = c.var.schoolApp.repositories;

  const interactiveContext = {
    subjectId: user.id,
    schoolId: "school-default", // Can be resolved dynamically based on request parameters/headers
    requestId: c.req.header("x-request-id") || `req-${Math.random().toString(36).substr(2, 9)}`,
    authenticatedAt: new Date(session.session.createdAt),
    assuranceLevel: ActorAssuranceLevel.Standard,
  };

  let actor: any = null;

  // 1. Search staffMembers repository by subjectId
  const staff = await repos.staffMembers.findOne({ subjectId: user.id });
  if (staff) {
    actor = createStaffActorMetadata({
      ...interactiveContext,
      schoolId: staff.schoolId,
      staffMemberId: staff.id,
      roles: staff.roles,
    });
  }
  else {
    // 2. Fallback: Search guardians repository by subjectId
    const guardian = await repos.guardians.findOne({ subjectId: user.id });
    if (guardian) {
      actor = createGuardianActorMetadata({
        ...interactiveContext,
        schoolId: guardian.schoolId,
        guardianId: guardian.id,
      });
    }
    else {
      // 3. Fallback: Search students repository by subjectId
      const student = await repos.students.findOne({ subjectId: user.id });
      if (student) {
        actor = createStudentActorMetadata({
          ...interactiveContext,
          schoolId: student.schoolId,
          studentId: student.id,
        });
      }
    }
  }

  c.set("actor", actor);
  await next();
};
