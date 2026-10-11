import { Attachment, AttachmentOwnerKind, AttachmentStatus, Permission, StaffPermissionAssignment } from "@edaya/core";
import { describe, expect, it } from "bun:test";
import { createNativePolicyApp } from "../support/native-policy-app";

describe("file content route", () => {
  it("denies anonymous access to profile images", async () => {
    const { app } = await createNativePolicyApp(null);
    const response = await app.request("/core/files/att-1/content", { redirect: "manual" });
    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
  });

  it("returns a private grant only while the current attachment policy permits access", async () => {
    const { app, repositories } = await createNativePolicyApp();
    await repositories.attachments.save(new Attachment({ id: "attachment", schoolId: "school-a", ownerKind: AttachmentOwnerKind.Staff, ownerId: "staff-a", fileName: "notes.pdf", storageKey: "school-a/private/notes.pdf", status: AttachmentStatus.Ready, mimeType: "application/pdf", sizeBytes: 100 }));
    const request = () => app.request("/core/files/attachment/download-url");
    expect((await request()).status).toBe(403);
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: "read", schoolId: "school-a", staffId: "staff-a", academicYearId: "year-a", permission: Permission.ATTACHMENT_READ, scopes: [{ kind: "school" }] }));
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ downloadUrl: "noop://download/notes.pdf" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
    await repositories.staffPermissionAssignments.delete("read");
    expect((await request()).status).toBe(403);
  });
  it("does not expose an external legacy link through either private delivery endpoint", async () => {
    const { app, repositories } = await createNativePolicyApp();
    const legacy = new Attachment({ id: "legacy", schoolId: "school-a", ownerKind: AttachmentOwnerKind.Staff, ownerId: "staff-a", fileName: "legacy.pdf", fileUrl: "https://external.example/private?credential=legacy", status: AttachmentStatus.Ready });
    await repositories.attachments.save(legacy);
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: "legacy-read", schoolId: "school-a", staffId: "staff-a", academicYearId: "year-a", permission: Permission.ATTACHMENT_READ, scopes: [{ kind: "school" }] }));
    for (const suffix of ["content", "download-url"]) {
      const response = await app.request(`/core/files/legacy/${suffix}`, { redirect: "manual" });
      expect(response.status).toBe(404);
      expect(response.headers.get("location")).toBeNull();
      expect(await response.text()).toBe(JSON.stringify({ message: "Attachment not found" }));
    }
    expect((await repositories.attachments.findById(legacy.id))?.data).toEqual(legacy.data);
  });
  it("conceals purpose-restricted files even with school-wide attachment read permission", async () => {
    const { app, repositories } = await createNativePolicyApp();
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: "purpose-read", schoolId: "school-a", staffId: "staff-a", academicYearId: "year-a", permission: Permission.ATTACHMENT_READ, scopes: [{ kind: "school" }] }));
    await repositories.attachments.save(new Attachment({ id: "restricted", schoolId: "school-a", ownerKind: AttachmentOwnerKind.Staff, ownerId: "staff-a", purpose: "fixture.private", fileName: "secret.pdf", fileUrl: "https://private.example/secret", mimeType: "application/pdf", sizeBytes: 100 }));
    const list = await app.request("/core/entities/attachments/list", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(list.status).toBe(200);
    expect(await list.json() as unknown).toEqual([]);
    const count = await app.request("/core/entities/attachments/count", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(count.status).toBe(200);
    expect(await count.json() as unknown).toEqual({ count: 0 });
    for (const suffix of ["content", "download-url"]) {
      const response = await app.request(`/core/files/restricted/${suffix}`, { redirect: "manual" });
      expect(response.status).toBe(404);
      expect(response.headers.get("location")).toBeNull();
      expect(await response.text()).not.toContain("private.example");
    }
  });
});
