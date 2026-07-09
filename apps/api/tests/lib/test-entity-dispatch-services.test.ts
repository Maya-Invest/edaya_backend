import { describe, expect, test } from "bun:test";
import { getEntityReadService, getEntityWriteService } from "@/lib/school-api/dispatch/entities";

function readService() {
  return {
    list: async () => [],
    findOne: async () => undefined,
    count: async () => 0,
    findById: async () => undefined,
    findByIds: async () => [],
  };
}

function writeService() {
  return {
    save: async () => {},
    batchSave: async () => [],
    delete: async () => {},
    batchDelete: async () => {},
  };
}

describe("entity dispatch services", () => {
  test("returns read and write services when entity repositories expose the full surface", () => {
    const students = {
      ...readService(),
      ...writeService(),
    };
    const service = {
      baseService: {
        entities: {
          students,
        },
      },
    } as never;

    expect(getEntityReadService(service, "students")).toBe(students);
    expect(getEntityWriteService(service, "students")).toBe(students);
  });

  test("returns null when the entity repository is missing or incomplete", () => {
    const service = {
      baseService: {
        entities: {
          students: {
            list: async () => [],
          },
        },
      },
    } as never;

    expect(getEntityReadService(service, "students")).toBeNull();
    expect(getEntityWriteService(service, "students")).toBeNull();
    expect(getEntityReadService(service, "schools")).toBeNull();
  });
});
