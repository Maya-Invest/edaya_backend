import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { expect, test } from "bun:test";
import { invitedEmailPolicy } from "../registration-policy";

test("only a current pending invitation for the proven email and supported actor is eligible", async () => {
  const invitation = { kind: "staff", contactValue: "  Staff@Example.Test ", contactChannel: "email", status: "pending", expiresAt: new Date(Date.now() + 60000) };
  let stored = { ...invitation };
  const school = { repositories: { accountInvitations: { findByTokenHash: async (hash: string) => hash === "matching-hash" ? stored : undefined } } };
  const eligible = invitedEmailPolicy(async () => school as unknown as ApiSchoolApplication);
  for (const kind of ["staff", "teacher", "guardian"]) {
    stored = { ...invitation, kind };
    expect(await eligible("staff@example.test", "matching-hash")).toBe(true);
  }
  expect(await eligible("someone@example.test", "matching-hash")).toBe(false);
  expect(await eligible("staff@example.test", "different-hash")).toBe(false);
  for (const change of [{ kind: "student" }, { status: "accepted" }, { status: "revoked" }, { status: "expired" }, { contactChannel: "phone" }, { expiresAt: new Date(0) }]) {
    stored = { ...invitation, ...change };
    expect(await eligible("staff@example.test", "matching-hash")).toBe(false);
  }
});
