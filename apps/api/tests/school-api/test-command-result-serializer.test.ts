import { describe, expect, it } from "bun:test";
import { Guardian, StaffMember } from "@edaya/core";
import { serializeCommandResult } from "@/lib/school-api/serialize/command-result";

describe("serializeCommandResult", () => {
  it("flattens domain entities returned from commands", () => {
    const staff = new StaffMember({
      id: "st9",
      schoolId: "sch-edaya-central",
      firstName: "Paul",
      lastName: "Martin",
      email: "p.martin@school.edu",
      subjectId: "auth-user-1",
    });

    const serialized = serializeCommandResult(staff) as {
      id: string;
      subjectId: string;
      firstName: string;
    };

    expect(serialized.id).toBe("st9");
    expect(serialized.subjectId).toBe("auth-user-1");
    expect(serialized.firstName).toBe("Paul");
    expect(serialized).not.toHaveProperty("data");
  });

  it("flattens linkActorSubject responses", () => {
    const guardian = new Guardian({
      id: "g9",
      schoolId: "sch-edaya-central",
      firstName: "Claire",
      lastName: "Laurent",
      email: "c.laurent@mail.com",
      phone: "+33 6 12 34 56 78",
      subjectId: "auth-user-2",
    });

    const serialized = serializeCommandResult({ kind: "guardian", entity: guardian }) as {
      kind: string;
      entity: {
        id: string;
        subjectId: string;
        data?: unknown;
      };
    };

    expect(serialized.kind).toBe("guardian");
    expect(serialized.entity.id).toBe("g9");
    expect(serialized.entity.subjectId).toBe("auth-user-2");
    expect(serialized.entity).not.toHaveProperty("data");
  });
});
