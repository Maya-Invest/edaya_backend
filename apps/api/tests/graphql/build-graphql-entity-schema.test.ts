import { describe, expect, it } from "bun:test";
import { GraphQLInputObjectType } from "graphql";
import { buildGraphQLEntitySchema } from "@/lib/graphql/routes/entities";

describe("buildGraphQLEntitySchema", () => {
  it("mirrors core entity routes with query and mutation fields", () => {
    const schema = buildGraphQLEntitySchema();
    const queryFields = schema.getQueryType()!.getFields();
    const mutationFields = schema.getMutationType()!.getFields();

    expect(queryFields.students).toBeDefined();
    expect(queryFields.student).toBeDefined();
    expect(queryFields.studentsCount).toBeDefined();
    expect(queryFields.studentById).toBeDefined();

    expect(mutationFields.saveStudent).toBeUndefined();
    expect(mutationFields.saveSchool).toBeDefined();
    expect(mutationFields.deleteStudent).toBeDefined();
  });

  it("exposes typed StudentFilter input for entity list queries", () => {
    const schema = buildGraphQLEntitySchema();
    const studentFilter = schema.getType("StudentFilter");
    expect(studentFilter).toBeInstanceOf(GraphQLInputObjectType);

    const fields = (studentFilter as GraphQLInputObjectType).getFields();
    expect(fields.firstName?.type.toString()).toBe("StringFilter");
    expect(fields.limit?.type.toString()).toBe("Int");
    expect(fields.and?.type.toString()).toBe("[StudentFilter!]");

    const studentsField = schema.getQueryType()!.getFields().students;
    const filterArg = studentsField.args.find(arg => arg.name === "filter");
    expect(filterArg?.type.toString()).toBe("StudentFilter");
    expect(studentsField.type.toString()).toBe("[Student!]!");
  });
});
