import { describe, expect, test } from "bun:test";
import { handleGraphiQLSession } from "@/lib/graphql/graphiql-session";
import { createTestStaffActor } from "../support/staff-actor-fixture";

interface MockHandlerResponse {
  body: unknown;
  status: number;
}

function createContext(options: {
  nodeEnv?: string;
  session?: {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
    };
    session: {
      createdAt: string;
    };
  } | null;
  actor?: ReturnType<typeof createTestStaffActor> | null;
}) {
  const jsonBody: MockHandlerResponse = { body: undefined, status: 200 };

  return {
    env: { NODE_ENV: options.nodeEnv ?? "test" },
    req: { raw: { headers: new Headers() } },
    get(key: string) {
      if (key === "auth") {
        return {
          api: {
            getSession: async () => options.session ?? null,
          },
        };
      }
      if (key === "actor") {
        return options.actor ?? null;
      }
      return undefined;
    },
    json(body: unknown, status = 200) {
      jsonBody.body = body;
      jsonBody.status = status;
      return jsonBody;
    },
  } as never;
}

describe("handleGraphiQLSession", () => {
  test("returns 404 when GraphiQL is disabled", async () => {
    const response = await handleGraphiQLSession(createContext({ nodeEnv: "production" })) as MockHandlerResponse;

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "GraphiQL session is disabled" });
  });

  test("returns session and interactive actor metadata when both are present", async () => {
    const actor = createTestStaffActor();
    const response = await handleGraphiQLSession(createContext({
      session: {
        user: {
          id: "user-1",
          email: "teacher@school.edu",
          name: "Teacher",
        },
        session: {
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      },
      actor,
    })) as MockHandlerResponse;

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      session: {
        userId: "user-1",
        email: "teacher@school.edu",
        name: "Teacher",
      },
      actor: {
        kind: "staff",
        actorId: "staff-1",
        schoolId: "school-1",
      },
    });
  });

  test("returns null actor when no interactive actor is attached", async () => {
    const response = await handleGraphiQLSession(createContext({
      session: {
        user: {
          id: "user-1",
          email: "teacher@school.edu",
        },
        session: {
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      },
      actor: null,
    })) as MockHandlerResponse;

    expect(response.body).toEqual({
      session: {
        userId: "user-1",
        email: "teacher@school.edu",
        name: null,
      },
      actor: null,
    });
  });
});
