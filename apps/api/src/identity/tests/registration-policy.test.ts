import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { expect, test } from "bun:test";
import { invitedEmailPolicy } from "../registration-policy";

test("only a current pending invitation for the proven email and supported actor is eligible", async () => {
  const invitation = { tokenHash: "matching-hash", kind: "staff", contactValue: "  Staff@Example.Test ", contactChannel: "email", status: "pending", expiresAt: new Date(Date.now() + 60000) };
  let stored = { ...invitation };
  const school = { repositories: { accountInvitations: { findByTokenHash: async (hash: string) => hash === "matching-hash" ? stored : undefined, findPendingByContact: async ({ kind }: { kind: string }) => kind === stored.kind ? [stored] : [] } } };
  const eligible = invitedEmailPolicy(async () => school as unknown as ApiSchoolApplication);
  for (const kind of ["staff", "teacher", "guardian"]) {
    stored = { ...invitation, kind };
    expect(await eligible("staff@example.test", "matching-hash")).toBe("matching-hash");
    expect(await eligible("staff@example.test")).toBe("matching-hash");
  }
  expect(await eligible("someone@example.test", "matching-hash")).toBeUndefined();
  expect(await eligible("staff@example.test", "different-hash")).toBeUndefined();
  for (const change of [{ kind: "student" }, { status: "accepted" }, { status: "revoked" }, { status: "expired" }, { contactChannel: "phone" }, { expiresAt: new Date(0) }]) {
    stored = { ...invitation, ...change };
    expect(await eligible("staff@example.test", "matching-hash")).toBeUndefined();
    expect(await eligible("staff@example.test")).toBeUndefined();
  }
});
