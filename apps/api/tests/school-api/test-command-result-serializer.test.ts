import { describe, expect, it, mock } from "bun:test";
import { demoCiDataset } from "@edaya/fixtures";
import { SEED_SCHOOL_ID } from "@edaya/fixtures/shared/ids";
import { AccountInvitation, AccountInvitationContactChannel, AccountInvitationKind, AccountInvitationStatus, AttendanceRecord, AttendanceStatus, Guardian, StaffMember } from "@edaya/core";
import { dispatchCoreCommand, serializeCommandResult } from "@/lib/school-api/dispatch/commands";

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

  it("serializes bulk attendance as the declared flat response list", () => {
    const attendance = new AttendanceRecord({ id: "record-1", studentId: "student-1", attendanceId: "day-1", date: new Date("2026-09-28"), status: AttendanceStatus.Present });
    const serialized = serializeCommandResult([attendance]);
    expect(serialized).toEqual([attendance.data]);
    expect(serialized).not.toEqual([{ data: attendance.data }]);
    expect(serializeCommandResult([])).toEqual([]);
  });

  it("flattens linkActorSubject responses", () => {
    const guardianFixture = demoCiDataset.entities.guardians![0]!;
    const guardian = new Guardian({
      id: "g9",
      schoolId: SEED_SCHOOL_ID,
      firstName: guardianFixture.firstName,
      lastName: guardianFixture.lastName,
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

  it("redacts invitation tokens from sendAccountInvitation responses", () => {
    const invitation = new AccountInvitation({
      id: "inv-1",
      schoolId: SEED_SCHOOL_ID,
      kind: AccountInvitationKind.Staff,
      targetId: "st9",
      contactChannel: AccountInvitationContactChannel.Email,
      contactValue: "p.martin@school.edu",
      tokenHash: "hashed-token",
      status: AccountInvitationStatus.Pending,
      expiresAt: new Date("2026-12-31T00:00:00.000Z"),
      createdByStaffId: "staff-admin",
    });

    const serialized = serializeCommandResult({
      invitation,
      token: "plain-token",
    }) as {
      invitation: { id: string; tokenHash?: string };
      token: string;
    };

    expect(serialized.token).toBe("plain-token");
    expect(serialized.invitation.id).toBe("inv-1");
    expect(serialized.invitation).not.toHaveProperty("tokenHash");
  });

  it("passes through primitive command results unchanged", () => {
    expect(serializeCommandResult(null)).toBeNull();
    expect(serializeCommandResult("done")).toBe("done");
  });
});

describe("dispatchCoreCommand", () => {
  it("delegates to the school service command registry", async () => {
    const publishAcademicYear = mock(async () => ({ id: "year-1" }));
    const service = {
      commands: { publishAcademicYear },
    } as never;

    await expect(dispatchCoreCommand(service, "publishAcademicYear", {
      academicYearId: "year-1",
    })).resolves.toEqual({ id: "year-1" });
  });
});
