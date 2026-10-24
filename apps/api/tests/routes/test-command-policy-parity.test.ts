import type { SchoolCommandKey } from "@edaya/service";
import { ActorAssuranceLevel, AuthorizationError, createServiceStaffActorMetadata, createStaffActorMetadata, createSystemActorMetadata } from "@edaya/authorization";
import { AccountInvitation, AccountInvitationContactChannel, AccountInvitationKind, Announcement, AnnouncementStatus, AnnouncementTarget, AnnouncementTargetKind, MessageDelivery, MessageDeliveryStatus, Permission, School, StaffMember, StaffPermissionAssignment, SubjectMatter } from "@edaya/core";
import { dispatchSchoolCommand } from "@edaya/service";
import { expect, test } from "bun:test";
import { coreCommands } from "@/lib/school-api/registry";
import { hashInvitationToken } from "../../../../package/domain-service/src/capabilities/invitations/invitation-token";
import { createNativePolicyApp } from "../support/native-policy-app";

const identity = { schoolId: "school-a", staffMemberId: "staff-a", subjectId: "person-a", authenticatedAt: new Date(), requestId: "command-parity", assuranceLevel: ActorAssuranceLevel.Strong };
const commands: Array<{ method: SchoolCommandKey; input: Record<string, unknown> }> = [
  { method: "materializeDeliveries", input: { announcementId: "announcement" } },
  { method: "recordDelivery", input: { id: "recorded", schoolId: "school-a", subjectId: "person-a", title: "Record", body: "Delivery" } },
  { method: "applyDeliveryEvent", input: { deliveryId: "delivery", status: "sent" } },
  { method: "acceptAccountInvitation", input: { token: "invitation-token", subjectId: "invited-person", contactValue: "invitee@example.com" } },
];

test.each(["human", "service"] as const)("%s command caller receives the same decision through workflow and REST", async (kind) => {
  const actor = kind === "human" ? createStaffActorMetadata(identity) : createServiceStaffActorMetadata(identity);
  const { app, school, repositories } = await createNativePolicyApp(actor);
  const ownerSchool = (await repositories.schools.findById("school-a"))!;
  await repositories.schools.save(new School({ ...ownerSchool.data, ownerSubjectId: "person-a" }));
  if (kind === "service") {
    const before = (await repositories.staffMembers.findById("staff-a"))!;
    await repositories.staffMembers.save(new StaffMember({ ...before.data, subjectId: undefined, accountKind: "service", serviceId: "integration", serviceElevated: true }));
  }
  await repositories.subjectMatters.save(new SubjectMatter({ id: "matter", subjectId: "math", name: "Numbers", sequenceOrder: 1 }));
  await repositories.announcements.save(new Announcement({ id: "announcement", schoolId: "school-a", title: "News", content: "School news", status: AnnouncementStatus.Published, publishedAt: new Date() }));
  await repositories.announcementTargets.save(new AnnouncementTarget({ id: "target", announcementId: "announcement", targetKind: AnnouncementTargetKind.School }));
  await repositories.messageDeliveries.save(new MessageDelivery({ id: "delivery", schoolId: "school-a", subjectId: "person-a", title: "Notice", body: "Body" }));
  await repositories.staffMembers.save(new StaffMember({ id: "invitee", schoolId: "school-a", firstName: "Invited", lastName: "Staff", email: "invitee@example.com" }));
  await repositories.accountInvitations.save(new AccountInvitation({ id: "invitation", schoolId: "school-a", kind: AccountInvitationKind.Staff, targetId: "invitee", contactChannel: AccountInvitationContactChannel.Email, contactValue: "invitee@example.com", tokenHash: hashInvitationToken("invitation-token"), expiresAt: new Date("2999-01-01"), createdByStaffId: "staff-a" }));

  for (const { method, input } of commands) {
    const config = coreCommands.find(command => command.methodName === method)!;
    const direct = dispatchSchoolCommand(school.forActor(actor).commands, method, input);
    if (kind === "human")
      await expect(direct).rejects.toBeInstanceOf(AuthorizationError);
    else await direct;
    const rest = await app.request(`/core/commands/${config.publicName}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    expect(rest.status).toBe(kind === "human" ? 403 : 200);
  }
  for (const id of ["delivery", "generic-new"]) {
    const input = { id, schoolId: "school-a", subjectId: "person-a", title: "Notice", body: "Body", status: MessageDeliveryStatus.Sent, sentAt: new Date().toISOString() };
    const entities = school.forActor(actor).baseService.entities.messageDeliveries;
    for (const write of [() => entities.save(new MessageDelivery(input)), () => entities.batchSave([new MessageDelivery(input)])]) {
      if (kind === "human")
        await expect(write()).rejects.toBeInstanceOf(AuthorizationError);
      else await write();
    }
    for (const [path, payload] of [["save", input], ["batch-save", { entities: [input] }]] as const) {
      const response = await app.request(`/core/entities/message-deliveries/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      expect(response.status).toBe(kind === "human" ? 403 : 200);
    }
  }
  expect(Boolean(await repositories.messageDeliveries.findById("generic-new"))).toBe(kind === "service");
  expect((await repositories.staffMembers.findById("invitee"))?.subjectId).toBe(kind === "human" ? undefined : "invited-person");
}, 30_000);

test("scoped service imports retain action isolation, both placements, validity and account revocation", async () => {
  const actor = createServiceStaffActorMetadata(identity);
  const { school, repositories } = await createNativePolicyApp(actor);
  const before = (await repositories.staffMembers.findById("staff-a"))!;
  const profile = new StaffMember({ ...before.data, subjectId: undefined, accountKind: "service", serviceId: "integration" });
  await repositories.staffMembers.save(profile);
  const update = new StaffPermissionAssignment({ id: "update", schoolId: "school-a", staffId: "staff-a", academicYearId: "year-a", permission: Permission.ACADEMIC_PROGRAM_MANAGE, scopes: [{ kind: "class_group", classGroupId: "class-a" }] });
  await repositories.staffPermissionAssignments.save(update);
  await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ ...update.data, id: "read", permission: Permission.ACADEMIC_PROGRAM_READ, scopes: [{ kind: "class_group", classGroupId: "class-other" }] }));
  const workflow = school.forActor(actor).academicsWorkflow;
  const own = { classSubjectId: "math-a", isOffered: false, expectedParticipationRevision: 0 };
  await workflow.setClassSubjectOffered(own);
  for (const proposal of [
    { ...own, classSubjectId: "math-other" },
    { ...own, classSubjectId: "math-b" },
  ]) await expect(workflow.setClassSubjectOffered(proposal)).rejects.toBeInstanceOf(AuthorizationError);
  await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ ...update.data, endsAt: new Date("2000-01-01") }));
  await expect(workflow.setClassSubjectOffered(own)).rejects.toBeInstanceOf(AuthorizationError);
  await repositories.staffPermissionAssignments.save(update);
  await repositories.staffMembers.save(new StaffMember({ ...profile.data, isActive: false }));
  await expect(workflow.setClassSubjectOffered(own)).rejects.toBeInstanceOf(AuthorizationError);
  expect((await repositories.classSubjects.findById("math-a"))?.classGroupId).toBe("class-a");
});

test("missing delivery retries still require an admitted caller and its action", async () => {
  const actor = createStaffActorMetadata(identity);
  const { school, repositories } = await createNativePolicyApp(actor);
  const ownerSchool = (await repositories.schools.findById("school-a"))!;
  await repositories.schools.save(new School({ ...ownerSchool.data, ownerSubjectId: "person-a" }));
  const event = { deliveryId: "missing", status: MessageDeliveryStatus.Sent } as const;
  await expect(school.forActor(actor).communicationsWorkflow.applyDeliveryEvent(event)).rejects.toBeInstanceOf(AuthorizationError);
  for (const systemId of ["unknown-job", "expireAccountInvitations"]) {
    const job = createSystemActorMetadata({ schoolId: "school-a", systemId, requestId: "missing", reason: "Verify no-op boundary" });
    await expect(school.forActor(job).communicationsWorkflow.applyDeliveryEvent(event)).rejects.toBeInstanceOf(AuthorizationError);
  }
  const webhook = createSystemActorMetadata({ schoolId: "school-a", systemId: "notification-delivery-webhook", requestId: "missing", reason: "Apply provider event" });
  await expect(school.forActor(webhook).communicationsWorkflow.applyDeliveryEvent(event)).resolves.toBeUndefined();
  const service = createServiceStaffActorMetadata(identity);
  const before = (await repositories.staffMembers.findById("staff-a"))!;
  await repositories.staffMembers.save(new StaffMember({ ...before.data, subjectId: undefined, accountKind: "service", serviceId: "integration" }));
  await expect(school.forActor(service).communicationsWorkflow.applyDeliveryEvent(event)).rejects.toBeInstanceOf(AuthorizationError);
});
