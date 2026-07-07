import { describe, expect, test } from "bun:test";
import { Kind } from "graphql";
import { GraphQLJSON } from "@/lib/graphql/scalars/json";

describe("GraphQLJSON scalar", () => {
  test("serializes and parses values unchanged", () => {
    const value = { title: "Hello", count: 2, enabled: true, tags: ["a"] };
    expect(GraphQLJSON.serialize(value)).toBe(value);
    expect(GraphQLJSON.parseValue(value)).toBe(value);
  });

  test("parses literal strings, numbers, lists, and objects", () => {
    expect(GraphQLJSON.parseLiteral({ kind: Kind.STRING, value: "hello" }, {})).toBe("hello");
    expect(GraphQLJSON.parseLiteral({ kind: Kind.INT, value: "42" }, {})).toBe(42);
    expect(GraphQLJSON.parseLiteral({ kind: Kind.FLOAT, value: "3.5" }, {})).toBe(3.5);
    expect(GraphQLJSON.parseLiteral({ kind: Kind.BOOLEAN, value: true }, {})).toBe(true);
    expect(GraphQLJSON.parseLiteral({ kind: Kind.NULL }, {})).toBeNull();
    expect(GraphQLJSON.parseLiteral({
      kind: Kind.LIST,
      values: [{ kind: Kind.STRING, value: "a" }],
    }, {})).toEqual(["a"]);
    expect(GraphQLJSON.parseLiteral({
      kind: Kind.OBJECT,
      fields: [{
        kind: Kind.OBJECT_FIELD,
        name: { kind: Kind.NAME, value: "label" },
        value: { kind: Kind.STRING, value: "Beta" },
      }],
    }, {})).toEqual({ label: "Beta" });
  });
});
