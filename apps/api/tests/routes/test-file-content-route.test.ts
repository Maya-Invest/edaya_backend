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

  it("returns a direct URL only while the current attachment grant permits access", async () => {
    const { app, repositories } = await createNativePolicyApp();
    await repositories.attachments.save(new Attachment({ id: "attachment", schoolId: "school-a", ownerKind: AttachmentOwnerKind.Staff, ownerId: "staff-a", fileName: "notes.pdf", fileUrl: "https://cdn.example/notes.pdf", status: AttachmentStatus.Ready, mimeType: "application/pdf", sizeBytes: 100 }));
    const request = () => app.request("/core/files/attachment/download-url");
    expect((await request()).status).toBe(403);
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: "read", schoolId: "school-a", staffId: "staff-a", academicYearId: "year-a", permission: Permission.ATTACHMENT_READ, scopes: [{ kind: "school" }] }));
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ downloadUrl: "https://cdn.example/notes.pdf" });
    await repositories.staffPermissionAssignments.delete("read");
    expect((await request()).status).toBe(403);
  });
});
