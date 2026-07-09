import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { mountGraphQLRoute } from "@/lib/graphql/mount";
import type { AppBindings } from "@/http/types";
import { ActorAssuranceLevel } from "@edaya/authorization";
import type { Permission } from "@edaya/authorization";

const mockActor = {
  kind: "staff" as const,
  accountKind: "human" as const,
  actorId: "staff-1",
  subjectId: "admin-user",
  schoolId: "school-1",
  staffMemberId: "staff-1",
  effectiveGrants: {
    permissions: new Set<Permission>(),
    scopeGrants: [],
    isElevated: true,
  },
  requestId: "request-id",
  authenticatedAt: new Date(),
  assuranceLevel: ActorAssuranceLevel.Strong,
};

function createGraphQLTestApp(actor: typeof mockActor | null) {
  const app = new Hono<AppBindings>();
  const listStudents = mock(async () => [{ id: "student-1" }]);

  app.use(async (c, next) => {
    c.set("actor", actor);
    c.set("schoolApp", {
      forActor: () => ({
        baseService: {
          entities: {
            students: {
              list: listStudents,
              findOne: mock(async () => undefined),
              count: mock(async () => 0),
              findById: mock(async () => undefined),
              findByIds: mock(async () => []),
            },
          },
        },
      }),
    } as any);
    await next();
  });
  mountGraphQLRoute(app);
  return { app, listStudents };
}

describe("GraphQL entity auth", () => {
  it("rejects unauthenticated entity queries", async () => {
    const { app } = createGraphQLTestApp(null);

    const response = await app.request("/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "query { students(filter: { limit: 1 }) { id } }",
      }),
    });

    const payload = await response.json() as { errors?: Array<{ extensions?: { code?: string } }> };
    expect(payload.errors?.[0]?.extensions?.code).toBe("UNAUTHORIZED");
  });

  it("executes entity queries when actor is present", async () => {
    const { app, listStudents } = createGraphQLTestApp(mockActor);

    const response = await app.request("/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "query { students(filter: { limit: 1 }) { id } }",
      }),
    });

    const payload = await response.json() as { data?: { students?: Array<{ id: string }> }; errors?: unknown[] };
    expect(response.status).toBe(200);
    expect(payload.errors).toBeUndefined();
    expect(payload.data?.students).toEqual([{ id: "student-1" }]);
    expect(listStudents).toHaveBeenCalled();
  });
});
