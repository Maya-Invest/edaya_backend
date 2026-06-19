import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  type GraphQLInputType,
} from "graphql";
import type { AnySchema } from "@/lib/school-api/schemas/helpers";
import { getQueryOptionFieldSchemas } from "@/lib/school-api/schemas/helpers";

function getZodTypeName(schema: AnySchema): string {
  return (schema as { _def?: { typeName?: string } })._def?.typeName ?? "";
}

function unwrapZodField(schema: AnySchema): AnySchema {
  let inner = schema;
  while (true) {
    const typeName = getZodTypeName(inner);
    if (typeName === "ZodOptional" || typeName === "ZodNullable" || typeName === "ZodDefault") {
      inner = (inner as { _def: { innerType: AnySchema } })._def.innerType;
      continue;
    }
    if (typeName === "ZodEffects") {
      const def = (inner as { _def: { schema?: AnySchema; innerType?: () => AnySchema } })._def;
      inner = def.schema ?? def.innerType?.() ?? inner;
      continue;
    }
    break;
  }
  return inner;
}

function extractFilterValueSchema(fieldFilterSchema: AnySchema): AnySchema {
  const inner = unwrapZodField(fieldFilterSchema);
  if (getZodTypeName(inner) === "ZodUnion") {
    const options = (inner as { _def: { options: AnySchema[] } })._def.options;
    const directValue = options.find(option => getZodTypeName(unwrapZodField(option)) !== "ZodObject");
    if (directValue) {
      return unwrapZodField(directValue);
    }
  }
  return inner;
}

function isIntegerSchema(schema: AnySchema): boolean {
  const checks = (schema as { _def?: { checks?: Array<{ kind?: string }> } })._def?.checks ?? [];
  return checks.some(check => check.kind === "int");
}

function buildOperatorFields(valueGraphQLType: GraphQLInputType) {
  const listType = new GraphQLList(new GraphQLNonNull(valueGraphQLType));
  return {
    eq: { type: valueGraphQLType },
    ne: { type: valueGraphQLType },
    in: { type: listType },
    nin: { type: listType },
    exists: { type: GraphQLBoolean },
    gt: { type: valueGraphQLType },
    gte: { type: valueGraphQLType },
    lt: { type: valueGraphQLType },
    lte: { type: valueGraphQLType },
  };
}

export const GraphQLSortDirectionEnum = new GraphQLEnumType({
  name: "SortDirection",
  values: {
    asc: { value: "asc" },
    desc: { value: "desc" },
  },
});

export const GraphQLEntitySortInput = new GraphQLInputObjectType({
  name: "EntitySortInput",
  fields: {
    field: { type: new GraphQLNonNull(GraphQLString) },
    direction: { type: new GraphQLNonNull(GraphQLSortDirectionEnum) },
  },
});

export const GraphQLStringFilterInput = new GraphQLInputObjectType({
  name: "StringFilter",
  fields: () => buildOperatorFields(GraphQLString),
});

export const GraphQLIntFilterInput = new GraphQLInputObjectType({
  name: "IntFilter",
  fields: () => buildOperatorFields(GraphQLInt),
});

export const GraphQLFloatFilterInput = new GraphQLInputObjectType({
  name: "FloatFilter",
  fields: () => buildOperatorFields(GraphQLFloat),
});

export const GraphQLBooleanFilterInput = new GraphQLInputObjectType({
  name: "BooleanFilter",
  fields: () => buildOperatorFields(GraphQLBoolean),
});

const sharedFilterInputTypes = [
  GraphQLStringFilterInput,
  GraphQLIntFilterInput,
  GraphQLFloatFilterInput,
  GraphQLBooleanFilterInput,
  GraphQLEntitySortInput,
];

function valueSchemaToFilterInput(valueSchema: AnySchema): GraphQLInputType {
  const inner = extractFilterValueSchema(valueSchema);
  const typeName = getZodTypeName(inner);

  switch (typeName) {
    case "ZodBoolean":
      return GraphQLBooleanFilterInput;
    case "ZodNumber":
      return isIntegerSchema(inner) ? GraphQLIntFilterInput : GraphQLFloatFilterInput;
    case "ZodString":
    case "ZodEnum":
    case "ZodNativeEnum":
      return GraphQLStringFilterInput;
    default:
      return GraphQLStringFilterInput;
  }
}

export class GraphQLFilterTypeRegistry {
  private readonly filterTypes = new Map<string, GraphQLInputObjectType>();

  getOrCreateEntityFilterType(typeName: string, querySchema: AnySchema): GraphQLInputObjectType {
    const filterName = `${typeName}Filter`;
    const existing = this.filterTypes.get(filterName);
    if (existing) {
      return existing;
    }

    const fieldSchemas = getQueryOptionFieldSchemas(querySchema);
    let filterType!: GraphQLInputObjectType;

    filterType = new GraphQLInputObjectType({
      name: filterName,
      fields: () => {
        const fields: Record<string, { type: GraphQLInputType }> = {};

        for (const [fieldName, fieldSchema] of Object.entries(fieldSchemas)) {
          fields[fieldName] = { type: valueSchemaToFilterInput(fieldSchema as AnySchema) };
        }

        fields.and = { type: new GraphQLList(new GraphQLNonNull(filterType)) };
        fields.or = { type: new GraphQLList(new GraphQLNonNull(filterType)) };
        fields.not = { type: filterType };
        fields.orderBy = { type: new GraphQLList(new GraphQLNonNull(GraphQLEntitySortInput)) };
        fields.limit = { type: GraphQLInt };
        fields.offset = { type: GraphQLInt };

        return fields;
      },
    });

    this.filterTypes.set(filterName, filterType);
    return filterType;
  }

  allTypes(): GraphQLInputObjectType[] {
    return [...this.filterTypes.values()];
  }
}

export function getSharedGraphQLFilterTypes() {
  return sharedFilterInputTypes;
}
