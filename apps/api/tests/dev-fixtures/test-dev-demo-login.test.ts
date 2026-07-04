import {
  buildDevDemoLoginAccounts,
  DEV_DEMO_LOGIN_ACCOUNTS,
  resolveDevDemoStaffRole,
} from "@edaya/fixtures/demo-login";
import { describe, expect, it } from "bun:test";

describe("dev demo login accounts", () => {
  it("resolves demo staff roles from fixture access role ids", () => {
    expect(resolveDevDemoStaffRole("st8")).toMatchObject({
      role: "owner",
      accessRoleId: "role-director",
    });
    expect(resolveDevDemoStaffRole("st5")).toMatchObject({
      role: "directeur",
      accessRoleId: "role-director",
    });
    expect(resolveDevDemoStaffRole("st3")).toMatchObject({
      role: "prof_principal",
      accessRoleId: "role-coordinator",
    });
    expect(resolveDevDemoStaffRole("st7")).toMatchObject({
      role: "educateur",
      accessRoleId: "role-educator",
    });
    expect(resolveDevDemoStaffRole("st1")).toMatchObject({
      role: "professeur",
      accessRoleId: "role-teacher",
    });
  });

  it("builds five login accounts with one teacher representative", () => {
    const accounts = buildDevDemoLoginAccounts();

    expect(accounts).toEqual(DEV_DEMO_LOGIN_ACCOUNTS);
    expect(accounts).toHaveLength(5);
    expect(accounts.map(account => account.staffId)).toEqual(["st8", "st5", "st1", "st3", "st7"]);
    expect(accounts.find(account => account.staffId === "st8")).toMatchObject({
      role: "owner",
      email: "k.yann@school.edu",
      initials: "KY",
    });
    expect(accounts.find(account => account.staffId === "st5")).toMatchObject({
      role: "directeur",
      email: "c.moreau@school.edu",
      name: "Jean-Baptiste Aka",
      initials: "JA",
    });
    expect(accounts.find(account => account.staffId === "st1")).toMatchObject({
      name: "Mme Touré",
      initials: "MT",
    });
    expect(accounts.find(account => account.staffId === "st3")).toMatchObject({
      name: "Mme Assi",
      initials: "MA",
    });
    expect(accounts.find(account => account.staffId === "st7")).toMatchObject({
      role: "educateur",
      email: "t.evrard@school.edu",
      name: "M. Bamba",
      initials: "MB",
    });
    expect(accounts.some(account => account.staffId === "st2")).toBe(false);
  });
});
