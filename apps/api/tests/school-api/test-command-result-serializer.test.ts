import { describe, expect, it } from "bun:test";
import { SEED_GUARDIANS, SEED_SCHOOL_ID, splitDisplayName } from "@edaya/fixtures";
import { Guardian, StaffMember } from "@edaya/core";
import { serializeCommandResult } from "@/lib/school-api/dispatch/commands";

describe("serializeCommandResult", () => {
  it("flattens domain entities returned from commands", () => {
    const staff = new StaffMember({
      id: "st9",
      schoolId: SEED_SCHOOL_ID,
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
    const guardianFixture = SEED_GUARDIANS[0];
    const { firstName, lastName } = splitDisplayName(guardianFixture.name);
    const guardian = new Guardian({
      id: "g9",
      schoolId: SEED_SCHOOL_ID,
      firstName,
      lastName,
      email: guardianFixture.email,
      phone: guardianFixture.phone,
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
