import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInputObjectType,
  type GraphQLInputType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  type GraphQLOutputType,
  GraphQLString,
} from "graphql";
import type { AnySchema } from "@/lib/school-api/schemas/helpers";
import { unwrapShape } from "@/lib/school-api/schemas/helpers";

interface UnwrappedZodField {
  inner: AnySchema;
  nullable: boolean;
  optional: boolean;
}

function getZodTypeName(schema: AnySchema): string {
  return (schema as { _def?: { typeName?: string } })._def?.typeName ?? "";
}

function unwrapZodField(schema: AnySchema): UnwrappedZodField {
  let inner = schema;
  let nullable = false;
  let optional = false;

  while (true) {
    const typeName = getZodTypeName(inner);
    if (typeName === "ZodOptional") {
      optional = true;
      inner = (inner as { _def: { innerType: AnySchema } })._def.innerType;
      continue;
    }
    if (typeName === "ZodNullable") {
      nullable = true;
      inner = (inner as { _def: { innerType: AnySchema } })._def.innerType;
      continue;
    }
    if (typeName === "ZodDefault") {
      optional = true;
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

  return { inner, nullable, optional };
}

function applyOutputNullability(type: GraphQLOutputType, nullable: boolean, optional: boolean): GraphQLOutputType {
  if (optional || nullable) {
    return type;
  }
  return new GraphQLNonNull(type);
}

function applyInputNullability(type: GraphQLInputType, nullable: boolean, optional: boolean): GraphQLInputType {
  if (optional || nullable) {
    return type;
  }
  return new GraphQLNonNull(type);
}

export class GraphQLTypeRegistry {
  private readonly outputTypes = new Map<string, GraphQLObjectType>();
  private readonly inputTypes = new Map<string, GraphQLInputObjectType>();

  getOrCreateOutputType(typeName: string, schema: AnySchema): GraphQLObjectType {
    const existing = this.outputTypes.get(typeName);
    if (existing) {
      return existing;
    }

    const fields = () => this.buildOutputFields(typeName, schema);
    const type = new GraphQLObjectType({ name: typeName, fields });
    this.outputTypes.set(typeName, type);
    return type;
  }

  getOrCreateInputType(typeName: string, schema: AnySchema): GraphQLInputObjectType {
    const existing = this.inputTypes.get(typeName);
    if (existing) {
      return existing;
    }

    const fields = () => this.buildInputFields(typeName, schema);
    const type = new GraphQLInputObjectType({ name: typeName, fields });
    this.inputTypes.set(typeName, type);
    return type;
  }

  allTypes(): Array<GraphQLObjectType | GraphQLInputObjectType> {
    return [...this.outputTypes.values(), ...this.inputTypes.values()];
  }

  private buildOutputFields(parentTypeName: string, schema: AnySchema) {
    const shape = unwrapShape(schema);
    const fields: Record<string, { type: GraphQLOutputType }> = {};

    for (const [key, fieldSchema] of Object.entries(shape)) {
      fields[key] = {
        type: this.zodToOutputType(fieldSchema as AnySchema, parentTypeName, key),
      };
    }

    return fields;
  }

  private buildInputFields(parentTypeName: string, schema: AnySchema) {
    const shape = unwrapShape(schema);
    const fields: Record<string, { type: GraphQLInputType }> = {};

    for (const [key, fieldSchema] of Object.entries(shape)) {
      fields[key] = {
        type: this.zodToInputType(fieldSchema as AnySchema, parentTypeName, key),
      };
    }

    return fields;
  }

  private nestedTypeName(parentTypeName: string, fieldName: string): string {
    return `${parentTypeName}${fieldName.charAt(0).toUpperCase()}${fieldName.slice(1)}`;
  }

  private zodToOutputType(schema: AnySchema, parentTypeName: string, fieldName: string): GraphQLOutputType {
    const { inner, nullable, optional } = unwrapZodField(schema);
    const typeName = getZodTypeName(inner);

    let resolved: GraphQLOutputType;

    switch (typeName) {
      case "ZodString":
        resolved = GraphQLString;
        break;
      case "ZodNumber":
        resolved = GraphQLFloat;
        break;
      case "ZodBoolean":
        resolved = GraphQLBoolean;
        break;
      case "ZodEnum":
      case "ZodNativeEnum":
        resolved = GraphQLString;
        break;
      case "ZodArray": {
        const itemType = (inner as { _def: { type: AnySchema } })._def.type;
        resolved = new GraphQLList(this.zodToOutputType(itemType, parentTypeName, fieldName));
        break;
      }
      case "ZodObject":
        resolved = this.getOrCreateOutputType(this.nestedTypeName(parentTypeName, fieldName), inner);
        break;
      default:
        resolved = GraphQLString;
        break;
    }

    return applyOutputNullability(resolved, nullable, optional);
  }

  private zodToInputType(schema: AnySchema, parentTypeName: string, fieldName: string): GraphQLInputType {
    const { inner, nullable, optional } = unwrapZodField(schema);
    const typeName = getZodTypeName(inner);

    let resolved: GraphQLInputType;

    switch (typeName) {
      case "ZodString":
        resolved = GraphQLString;
        break;
      case "ZodNumber":
        resolved = GraphQLFloat;
        break;
      case "ZodBoolean":
        resolved = GraphQLBoolean;
        break;
      case "ZodEnum":
      case "ZodNativeEnum":
        resolved = GraphQLString;
        break;
      case "ZodArray": {
        const itemType = (inner as { _def: { type: AnySchema } })._def.type;
        resolved = new GraphQLList(this.zodToInputType(itemType, parentTypeName, fieldName));
        break;
      }
      case "ZodObject":
        resolved = this.getOrCreateInputType(`${this.nestedTypeName(parentTypeName, fieldName)}Input`, inner);
        break;
      default:
        resolved = GraphQLString;
        break;
    }

    return applyInputNullability(resolved, nullable, optional);
  }
}

export function buildEntityGraphQLTypes(
  registry: GraphQLTypeRegistry,
  typeName: string,
  responseSchema: AnySchema,
  saveSchema: AnySchema,
) {
  return {
    outputType: registry.getOrCreateOutputType(typeName, responseSchema),
    inputType: registry.getOrCreateInputType(`${typeName}Input`, saveSchema),
  };
}

export const GraphQLBatchSaveResultType = new GraphQLObjectType({
  name: "EntityBatchSaveResult",
  fields: {
    ids: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))) },
  },
});

export const GraphQLDeleteResultType = new GraphQLObjectType({
  name: "EntityDeleteResult",
  fields: {
    message: { type: new GraphQLNonNull(GraphQLString) },
  },
});

export const GraphQLCountResultType = new GraphQLObjectType({
  name: "EntityCountResult",
  fields: {
    count: { type: new GraphQLNonNull(GraphQLInt) },
  },
});
