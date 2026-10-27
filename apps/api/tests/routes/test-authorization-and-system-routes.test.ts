import { Permission, StaffPermissionAssignment } from "@edaya/core";
import { describe, expect, it } from "bun:test";
import { useNativePolicyApps } from "../support/native-policy-app";

const createNativePolicyApp = useNativePolicyApps();

describe("authorization routes", () => {
  it("projects current persisted grants and reflects immediate revocation", async () => {
    const { app, repositories } = await createNativePolicyApp();
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: "read", staffId: "staff-a", schoolId: "school-a", academicYearId: "year-a", permission: Permission.STUDENT_READ, scopes: [{ kind: "all", grain: "student" }] }));
    const response = await app.request("/core/authorization/effective-grants");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ kind: "staff", actorId: "staff-a", grants: expect.arrayContaining([expect.objectContaining({ permission: Permission.STUDENT_READ, scopes: [{ kind: "all", grain: "student" }], source: "manual" })]) });
    await repositories.staffPermissionAssignments.delete("read");
    expect(await (await app.request("/core/authorization/effective-grants")).json()).toMatchObject({ grants: [{ permission: Permission.WORKSPACE_ACCESS, source: "relationship" }] });
  });

  it("returns 401 when no actor is present", async () => {
    const { app } = await createNativePolicyApp(null);
    expect((await app.request("/core/authorization/effective-grants")).status).toBe(401);
  });

  it("returns the canonical permission catalog for interactive staff", async () => {
    const { app } = await createNativePolicyApp();
    const response = await app.request("/core/authorization/permission-catalog");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ permission: Permission.STUDENT_READ })]) });
  });

  it("labels typed scope selections without disclosing foreign resources", async () => {
    const { app, repositories } = await createNativePolicyApp();
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: "admin", staffId: "staff-a", schoolId: "school-a", academicYearId: "year-a", permission: Permission.ACCESS_CONTROL_READ, scopes: [{ kind: "school" }] }));
    const response = await app.request("/core/authorization/scope/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ academicYearId: "year-a", items: [{ permission: Permission.ATTENDANCE_RECORD, scopes: [{ kind: "class_group", classGroupId: "class-a" }, { kind: "class_group", classGroupId: "class-b" }] }] }) });
    expect(response.status).toBe(200);
    const body = await response.json() as { items: { scopes: { scope: unknown; label: string; missing: boolean }[] }[] };
    expect(body.items[0]?.scopes).toEqual([{ label: "A", scope: { kind: "class_group", classGroupId: "class-a" }, missing: false }, { label: "Unavailable resource", scope: { kind: "class_group", classGroupId: "class-b" }, missing: true }]);
  });
});
