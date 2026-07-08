import { describe, expect, test } from "bun:test";
import { GraphQLError } from "graphql";
import { BusinessRuleViolationError, DomainValidationError } from "@edaya/core";
import { AuthorizationError, AuthorizationErrorCode } from "@edaya/authorization";
import {
  requireActor,
  toGraphQLError,
  wrapResolver,
} from "@/lib/graphql/resolver-utils";
import { EntityOperationError } from "@/lib/school-api/entities/operations";
import { createTestStaffActor } from "../support/staff-actor-fixture";

describe("toGraphQLError", () => {
  test("maps domain and authorization failures to GraphQL error codes", () => {
    expect(toGraphQLError(new EntityOperationError("NOT_FOUND", "Missing entity")).extensions?.code)
      .toBe("NOT_FOUND");
    expect(toGraphQLError(new AuthorizationError(AuthorizationErrorCode.Forbidden, "Denied")).extensions?.code)
      .toBe(AuthorizationErrorCode.Forbidden);
    expect(toGraphQLError(new DomainValidationError("Invalid input")).extensions?.code)
      .toBe("BAD_REQUEST");
    expect(toGraphQLError(new BusinessRuleViolationError("RULE_BROKEN", "Cannot save")).extensions?.code)
      .toBe("RULE_BROKEN");
    expect(toGraphQLError(new Error("Unexpected")).extensions?.code)
      .toBe("INTERNAL_SERVER_ERROR");
    expect(toGraphQLError("unknown").extensions?.code)
      .toBe("INTERNAL_SERVER_ERROR");
  });

  test("preserves existing GraphQL errors", () => {
    const error = new GraphQLError("Already graphql");
    expect(toGraphQLError(error)).toBe(error);
  });
});

describe("wrapResolver", () => {
  test("returns resolver results and converts thrown errors", async () => {
    const wrapped = wrapResolver(async () => ({ ok: true }));
    await expect(wrapped({}, {}, {} as never)).resolves.toEqual({ ok: true });

    const failing = wrapResolver(async () => {
      throw new EntityOperationError("UNAUTHORIZED", "Missing session");
    });
    await expect(failing({}, {}, {} as never)).rejects.toMatchObject({
      message: "Missing session",
      extensions: { code: "UNAUTHORIZED" },
    });
  });
});

describe("requireActor", () => {
  test("returns the actor from resolver context or rejects missing sessions", () => {
    const actor = createTestStaffActor();
    const context = {
      get(key: string) {
        return key === "actor" ? actor : undefined;
      },
    } as never;

    expect(requireActor(context)).toBe(actor);
    expect(() => requireActor({ get: () => undefined } as never)).toThrow(GraphQLError);
  });
});
