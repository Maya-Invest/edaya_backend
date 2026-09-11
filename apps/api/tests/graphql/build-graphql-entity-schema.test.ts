import { describe, expect, it } from "bun:test";
import { GraphQLInputObjectType } from "graphql";
import { buildGraphQLSchema } from "@/lib/graphql/routes/entities";
import { coreCommands, coreQueries } from "@/lib/school-api/registry";

describe("buildGraphQLSchema", () => {
  it("mirrors core entity routes with query and mutation fields", () => {
    const schema = buildGraphQLSchema();
    const queryFields = schema.getQueryType()!.getFields();
    const mutationFields = schema.getMutationType()!.getFields();

    expect(queryFields.students).toBeDefined();
    expect(queryFields.student).toBeDefined();
    expect(queryFields.studentsCount).toBeDefined();
    expect(queryFields.studentById).toBeDefined();

    expect(mutationFields.saveStudent).toBeUndefined();
    expect(mutationFields.saveSchool).toBeDefined();
    expect(mutationFields.deleteStudent).toBeUndefined();
    expect(mutationFields.deletePayment).toBeUndefined();
    expect(mutationFields.batchDeletePayment).toBeUndefined();
    expect(mutationFields.saveClassSubject).toBeUndefined();
    expect(mutationFields.batchSaveClassSubject).toBeUndefined();
    expect(mutationFields.deleteClassSubject).toBeDefined();
    expect(mutationFields.batchDeleteClassSubject).toBeDefined();
  });

  it("mirrors core query routes", () => {
    const schema = buildGraphQLSchema();
    const queryFields = schema.getQueryType()!.getFields();

    for (const queryConfig of coreQueries) {
      expect(queryFields[queryConfig.methodName]).toBeDefined();
    }

    expect(queryFields.getOverdueFeeCount.args.find(arg => arg.name === "input")?.type.toString())
      .toBe("GetOverdueFeeCountQueryInput!");
    expect(queryFields.getSchoolOverview.type.toString()).toBe("SchoolOverviewResponse!");
  });

  it("mirrors core command routes", () => {
    const schema = buildGraphQLSchema();
    const mutationFields = schema.getMutationType()!.getFields();

    for (const commandConfig of coreCommands) {
      expect(mutationFields[commandConfig.methodName]).toBeDefined();
    }

    expect(mutationFields.registerStudent.args.find(arg => arg.name === "input")?.type.toString())
      .toBe("RegisterStudentCommandInput!");
    expect(mutationFields.registerStudent.type.toString()).toBe("Student!");
  });

  it("exposes typed StudentFilter input for entity list queries", () => {
    const schema = buildGraphQLSchema();
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
