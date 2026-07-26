import { describe, expect, it } from "bun:test";
import { Permission } from "@edaya/authorization";
import {
  getStaffInvitePermissionPreset,
  STAFF_INVITE_PERMISSION_PRESETS,
} from "@/lib/onboarding/default-access-roles";
import {
  ACCESS_ROLE_ID_BY_INVITE_ROLE,
  isOnboardingStaffInviteRoleKey,
  ONBOARDING_STAFF_INVITE_ROLE_KEYS,
} from "@/lib/onboarding/staff-invite-roles";

describe("onboarding staff invite roles", () => {
  it("maps every invite role to a known permission preset", () => {
    for (const role of ONBOARDING_STAFF_INVITE_ROLE_KEYS) {
      expect(isOnboardingStaffInviteRoleKey(role)).toBe(true);
      const presetId = ACCESS_ROLE_ID_BY_INVITE_ROLE[role];
      expect(getStaffInvitePermissionPreset(presetId)?.id).toBe(presetId);
    }
  });

  it("gives studies director pedagogical rights without access assign or finance", () => {
    const preset = getStaffInvitePermissionPreset("role-studies-director");
    expect(preset).toBeDefined();
    expect(preset!.permissions).toContain(Permission.ACADEMIC_PROGRAM_CREATE);
    expect(preset!.permissions).toContain(Permission.REPORT_CARD_CONFIGURE);
    expect(preset!.permissions).toContain(Permission.SCHOOL_STRUCTURE_CONFIGURE);
    expect(preset!.permissions).toContain(Permission.ACCESS_CONTROL_READ);
    expect(preset!.permissions).not.toContain(Permission.ACCESS_CONTROL_ASSIGN);
    expect(preset!.permissions).not.toContain(Permission.PAYMENT_READ);
  });

  it("gives IT admin access and service accounts without grade write", () => {
    const preset = getStaffInvitePermissionPreset("role-it-admin");
    expect(preset).toBeDefined();
    expect(preset!.permissions).toContain(Permission.ACCESS_CONTROL_ASSIGN);
    expect(preset!.permissions).toContain(Permission.SERVICE_ACCOUNT_CREATE);
    expect(preset!.permissions).toContain(Permission.STAFF_CREATE);
    expect(preset!.permissions).not.toContain(Permission.GRADE_INPUT);
    expect(preset!.permissions).not.toContain(Permission.REPORT_CARD_PUBLISH);
  });

  it("gives accountant finance rights without pedagogy write", () => {
    const preset = getStaffInvitePermissionPreset("role-accountant");
    expect(preset).toBeDefined();
    expect(preset!.permissions).toContain(Permission.PAYMENT_RECORD);
    expect(preset!.permissions).toContain(Permission.FINANCIAL_CONFIG_CONFIGURE);
    expect(preset!.permissions).toContain(Permission.QUERY_OVERDUE_FEES_READ);
    expect(preset!.permissions).not.toContain(Permission.GRADE_INPUT);
    expect(preset!.permissions).not.toContain(Permission.ACCESS_CONTROL_ASSIGN);
  });

  it("registers dedicated presets alongside legacy coordinator/educator/director", () => {
    const ids = STAFF_INVITE_PERMISSION_PRESETS.map(preset => preset.id);
    expect(ids).toContain("role-studies-director");
    expect(ids).toContain("role-it-admin");
    expect(ids).toContain("role-accountant");
    expect(ids).toContain("role-coordinator");
  });
});
