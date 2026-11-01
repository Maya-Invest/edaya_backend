import { Guardian } from "@edaya/core";
import { describe, expect, test } from "bun:test";
import { serializeCommandResult } from "@/lib/school-api/dispatch/commands";
import { getEntityReadService, getEntityWriteService } from "@/lib/school-api/dispatch/entities";
import { executeEntityGet, executeEntityList } from "@/lib/school-api/entities/operations";

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

test("guardian reads and actor command results serialize flat contacts and preferences", async () => {
  const guardian = new Guardian({ id: "guardian-contacts", schoolId: "school-contacts", firstName: "Compound Given", lastName: "Compound Family", phone: "0012345", email: "fixture@example.invalid" });
  const entities = { guardians: { ...readService(), list: async () => [guardian], findById: async () => guardian } };
  const application = { forActor: () => ({ baseService: { entities } }) } as never;
  const actor = { id: "staff-contacts" } as never;

  const one = await executeEntityGet(actor, application, "guardians", "Guardian", guardian.id);
  const list = await executeEntityList(actor, application, "guardians", {});
  const linked = serializeCommandResult({ kind: "guardian", entity: guardian });
  for (const result of [one, list[0], (linked as { entity: unknown }).entity]) {
    expect(JSON.parse(JSON.stringify(result))).toMatchObject({ phone: guardian.phone, email: guardian.email, smsNotificationsEnabled: true });
    expect(JSON.parse(JSON.stringify(result))).not.toHaveProperty("contactMethods");
    expect(JSON.parse(JSON.stringify(result)).firstName).toBe("Compound Given");
  }
});
