import { describe, expect, it } from "bun:test";
import { normalizeGraphQLFilter } from "@/lib/graphql/normalize-graphql-filter";

describe("normalizeGraphQLFilter", () => {
  it("maps pagination and sort keys to repository query options", () => {
    expect(normalizeGraphQLFilter({
      limit: 10,
      offset: 5,
      orderBy: [{ field: "lastName", direction: "asc" }],
    })).toEqual({
      $limit: 10,
      $offset: 5,
      $orderBy: [{ field: "lastName", direction: "asc" }],
    });
  });

  it("maps field operators to repository filter operators", () => {
    expect(normalizeGraphQLFilter({
      schoolId: { eq: "school-1" },
      firstName: { in: ["Ada", "Bob"] },
    })).toEqual({
      schoolId: { $eq: "school-1" },
      firstName: { $in: ["Ada", "Bob"] },
    });
  });

  it("maps nested logical filters", () => {
    expect(normalizeGraphQLFilter({
      or: [
        { status: { eq: "active" } },
        { and: [{ firstName: { eq: "Ada" } }, { lastName: { eq: "Lovelace" } }] },
      ],
    })).toEqual({
      $or: [
        { status: { $eq: "active" } },
        { $and: [{ firstName: { $eq: "Ada" } }, { lastName: { $eq: "Lovelace" } }] },
      ],
    });
  });
});
