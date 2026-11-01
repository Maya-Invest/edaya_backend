import { expect, test } from "bun:test";
import { subjectEnrollmentResponseSchema } from "../../src/lib/school-api/schemas/entities";
import { manageSubjectEnrollmentsCommandSchema, studentSubjectEnrollmentsResponseSchema } from "../../src/lib/school-api/schemas/subject-enrollment";

test("current selection responses require neither interval history nor cancellation fields", () => {
  const row = { id: "selection", studentClassEnrollmentId: "placement", classSubjectId: "music", enrolledAt: "2026-10-24T12:00:00Z", endedAt: "2027-07-01T00:00:00Z", source: "explicit", scope: "periods", periods: [{ periodId: "term", activatedAt: "2026-10-24T12:00:00Z", startsAt: "2026-09-01T00:00:00Z", endsAt: "2027-01-01T00:00:00Z" }], revision: 0, createdAt: "2026-10-24T12:00:00Z" };
  expect(subjectEnrollmentResponseSchema.safeParse(row).success).toBe(true);
  expect(studentSubjectEnrollmentsResponseSchema.safeParse({ studentId: "student", enrollments: [row], placements: [], offerings: [], periods: [] }).success).toBe(true);
  expect(subjectEnrollmentResponseSchema.safeParse({ ...row, deletedAt: "2026-10-25T12:00:00Z", deletedBy: "staff" }).success).toBe(true);
});
test("selection commands accept withdrawal and reject legacy interval mutations", () => {
  const command = { requestId: "withdraw", expectedRevisions: { music: 1 }, operations: [{ studentClassEnrollmentId: "placement", classSubjectId: "music", selection: { scope: "none" } }] };
  expect(manageSubjectEnrollmentsCommandSchema.safeParse(command).success).toBe(true);
  expect(manageSubjectEnrollmentsCommandSchema.safeParse({ ...command, operations: [{ action: "end", id: "selection", endedAt: "2026-10-25T12:00:00Z" }] }).success).toBe(false);
});
