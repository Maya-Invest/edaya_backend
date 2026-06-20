import { GraphQLError } from "graphql";
import type { Context } from "hono";
import type { AppBindings } from "@/http/types";
import {
  isAuthorizationError,
  isBusinessRuleViolationError,
  isDomainValidationError,
} from "@/http/responses";
import { EntityOperationError } from "@/lib/school-api/entities/operations";

type GraphQLResolverContext = Context<AppBindings>;

export function toGraphQLError(error: unknown): GraphQLError {
  if (error instanceof EntityOperationError) {
    return new GraphQLError(error.message, {
      extensions: { code: error.code },
    });
  }
  if (error instanceof GraphQLError) {
    return error;
  }
  if (isAuthorizationError(error)) {
    return new GraphQLError(error.message, {
      extensions: { code: error.code ?? "FORBIDDEN" },
    });
  }
  if (isDomainValidationError(error)) {
    return new GraphQLError(error.message, {
      extensions: { code: "BAD_REQUEST" },
    });
  }
  if (isBusinessRuleViolationError(error)) {
    return new GraphQLError(error.message, {
      extensions: { code: error.code },
    });
  }
  if (error instanceof Error) {
    return new GraphQLError(error.message, {
      extensions: { code: "INTERNAL_SERVER_ERROR" },
    });
  }
  return new GraphQLError("Unknown error", {
    extensions: { code: "INTERNAL_SERVER_ERROR" },
  });
}

export function wrapResolver<TArgs>(
  resolver: (context: GraphQLResolverContext, args: TArgs) => Promise<unknown> | unknown,
) {
  return async (_parent: unknown, args: TArgs, context: GraphQLResolverContext) => {
    try {
      return await resolver(context, args);
    }
    catch (error) {
      throw toGraphQLError(error);
    }
  };
}

export function requireActor(context: GraphQLResolverContext) {
  const actor = context.get("actor");
  if (!actor) {
    throw new GraphQLError("Missing or invalid authorization session", {
      extensions: { code: "UNAUTHORIZED" },
    });
  }
  return actor;
}
