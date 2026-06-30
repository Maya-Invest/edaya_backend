import { describe, expect, it } from "bun:test";
import {
  createAppRequest,
  createCoreRouteTestApp,
  signInThroughApp,
  signUpAuthUser,
} from "../support/core-route-harness";

describe("onboarding invite-staff-members route", () => {
  it("creates access roles and registers invited staff with assignments", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    const email = "staff-owner@school.edu";
    const subjectId = await signUpAuthUser(runtime, {
      email,
      name: "Staff Owner",
    });
    const cookies = await signInThroughApp(app, { email });

    const registerResponse = await app.request(createAppRequest("/core/onboarding/register-school", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookies.join("; "),
      },
      body: JSON.stringify({
        name: "Staff Invite School",
        timeZone: "Europe/Paris",
        city: "Paris",
        country: "France",
      }),
    }));
    expect(registerResponse.status).toBe(200);
    const school = await registerResponse.json() as { id: string };

    const yearResponse = await app.request(createAppRequest("/core/commands/create-academic-year", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookies.join("; "),
      },
      body: JSON.stringify({
        id: "2025",
        schoolId: school.id,
        name: "2025 — 2026",
        startDate: "2025-09-01",
        endDate: "2026-07-03",
      }),
    }));
    expect(yearResponse.status).toBe(200);

    const response = await app.request(createAppRequest("/core/onboarding/invite-staff-members", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookies.join("; "),
      },
      body: JSON.stringify({
        invites: [
          { email: "prof@school.edu", role: "teacher" },
          { email: "cpe@school.edu", role: "cpe" },
        ],
      }),
    }));

    expect(response.status).toBe(200);
    const summary = await response.json() as { invitedCount: number; accessRolesEnsured: number };
    expect(summary.invitedCount).toBe(2);
    expect(summary.accessRolesEnsured).toBeGreaterThan(0);

    const ownerStaff = await application.repositories.staffMembers.findOne({ subjectId });
    const schoolId = ownerStaff?.schoolId;
    expect(schoolId).toBeTruthy();

    const roles = await application.repositories.accessRoles.list({ schoolId: schoolId! });
    expect(roles.some(role => role.id === "role-teacher")).toBe(true);

    const invitedStaff = await application.repositories.staffMembers.list({ schoolId: schoolId! });
    expect(invitedStaff.some(member => member.email === "prof@school.edu")).toBe(true);
    expect(invitedStaff.some(member => member.email === "cpe@school.edu")).toBe(true);

    const assignments = await application.repositories.staffRoleAssignments.list({ schoolId: schoolId! });
    expect(assignments.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects inviting the school owner email", async () => {
    const { app, runtime } = await createCoreRouteTestApp();
    const email = "owner-invite@school.edu";
    await signUpAuthUser(runtime, { email, name: "Owner Invite" });
    const cookies = await signInThroughApp(app, { email });

    const registerResponse = await app.request(createAppRequest("/core/onboarding/register-school", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookies.join("; "),
      },
      body: JSON.stringify({
        name: "Owner Invite School",
        timeZone: "Europe/Paris",
        ownerEmail: email,
      }),
    }));
    expect(registerResponse.status).toBe(200);

    const response = await app.request(createAppRequest("/core/onboarding/invite-staff-members", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookies.join("; "),
      },
      body: JSON.stringify({
        invites: [{ email, role: "teacher" }],
      }),
    }));

    expect(response.status).toBe(409);
    const body = await response.json() as { code?: string };
    expect(body.code).toBe("STAFF_INVITE_OWNER_EMAIL");
  });
});
