import { describe, expect, mock, test } from "bun:test";
import {
  createEntityMutationResolvers,
  createEntityQueryResolvers,
} from "@/lib/graphql/routes/entity-resolvers";
import { coreEntities } from "@/lib/school-api/registry";
import { createTestStaffActor } from "../support/staff-actor-fixture";

const subjectConfig = coreEntities.find(entity => entity.serviceName === "subjects")!;

function resolverContext(service: Record<string, unknown>) {
  const actor = createTestStaffActor();

  return {
    get(key: string) {
      if (key === "actor") {
        return actor;
      }
      if (key === "schoolApp") {
        return { forActor: () => service };
      }
      return undefined;
    },
  } as never;
}

describe("createEntityQueryResolvers", () => {
  test("delegates list, one, count, and byId to entity operations", async () => {
    const list = mock(async () => [{ id: "teacher-1" }]);
    const findOne = mock(async () => ({ id: "teacher-1" }));
    const count = mock(async () => 2);
    const findById = mock(async () => ({ id: "teacher-1" }));
    const resolvers = createEntityQueryResolvers(subjectConfig);
    const context = resolverContext({
      baseService: {
        entities: {
          subjects: { list, findOne, count, findById, findByIds: async () => [] },
        },
      },
    });

    await expect(resolvers.list({}, { filter: { limit: 10 } }, context)).resolves.toEqual([
      { id: "teacher-1" },
    ]);
    await expect(resolvers.one({}, { filter: { id: "teacher-1" } }, context)).resolves.toEqual({
      id: "teacher-1",
    });
    await expect(resolvers.count({}, { filter: { schoolId: "school-1" } }, context)).resolves.toEqual({
      count: 2,
    });
    await expect(resolvers.byId({}, { id: "teacher-1" }, context)).resolves.toEqual({
      id: "teacher-1",
    });

    expect(list).toHaveBeenCalled();
    expect(findOne).toHaveBeenCalled();
    expect(count).toHaveBeenCalled();
    expect(findById).toHaveBeenCalled();
  });
});

describe("createEntityMutationResolvers", () => {
  test("delegates save, delete, and batch mutations to entity operations", async () => {
    const save = mock(async () => ({ id: "teacher-1" }));
    const deleteEntity = mock(async () => undefined);
    const batchSave = mock(async () => ["subject-1"]);
    const batchDelete = mock(async () => undefined);
    const resolvers = createEntityMutationResolvers(subjectConfig);
    const context = resolverContext({
      baseService: {
        entities: {
          subjects: {
            list: async () => [],
            findOne: async () => undefined,
            count: async () => 0,
            findById: async () => undefined,
            findByIds: async () => [],
            save,
            delete: deleteEntity,
            batchSave,
            batchDelete,
          },
        },
      },
    });

    await expect(resolvers.save({}, {
      input: {
        id: "subject-1",
        schoolId: "school-1",
        name: "Mathematics",
        shortName: "Math",
        code: "MATH",
      },
    }, context)).resolves.toMatchObject({
      data: {
        id: "subject-1",
        name: "Mathematics",
      },
    });
    await expect(resolvers.delete({}, { id: "subject-1" }, context)).resolves.toEqual({
      message: "subjects subject-1 deleted",
    });
    await expect(resolvers.batchSave({}, {
      entities: [{
        id: "subject-1",
        schoolId: "school-1",
        name: "Mathematics",
        shortName: "Math",
        code: "MATH",
      }],
    }, context)).resolves.toEqual({ ids: ["subject-1"] });
    await expect(resolvers.batchDelete({}, { ids: ["subject-1"] }, context)).resolves.toEqual({
      message: "subjects batch deleted",
    });
  });
});
