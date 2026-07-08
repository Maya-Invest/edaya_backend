import { GraphQLScalarType, Kind } from "graphql";
import type { ValueNode } from "graphql";

function parseLiteral(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.NULL:
      return null;
    case Kind.LIST:
      return ast.values.map(parseLiteral);
    case Kind.OBJECT: {
      const value: Record<string, unknown> = {};
      for (const field of ast.fields) {
        value[field.name.value] = parseLiteral(field.value);
      }
      return value;
    }
    default:
      return null;
  }
}

export const GraphQLJSON = new GraphQLScalarType({
  name: "JSON",
  description: "Arbitrary JSON value",
  serialize: value => value,
  parseValue: value => value,
  parseLiteral,
});
