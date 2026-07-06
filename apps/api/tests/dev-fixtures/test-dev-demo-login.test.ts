import {
  buildDevDemoLoginAccounts,
  DEV_DEMO_LOGIN_ACCOUNTS,
  resolveDevDemoStaffRole,
} from "@edaya/fixtures/demo-login";
import { describe, expect, it } from "bun:test";

describe("dev demo login accounts", () => {
  it("resolves demo-ci staff roles from fixture access role ids", () => {
    expect(resolveDevDemoStaffRole("ci-st8")).toMatchObject({
      role: "owner",
      accessRoleId: "role-director",
    });
    expect(resolveDevDemoStaffRole("ci-st5")).toMatchObject({
      role: "directeur",
      accessRoleId: "role-director",
    });
    expect(resolveDevDemoStaffRole("ci-st3")).toMatchObject({
      role: "prof_principal",
      accessRoleId: "role-coordinator",
    });
    expect(resolveDevDemoStaffRole("ci-st7")).toMatchObject({
      role: "educateur",
      accessRoleId: "role-educator",
    });
  });

  it("builds four staff login accounts without portal teachers", () => {
    const accounts = buildDevDemoLoginAccounts();

    expect(accounts).toEqual(DEV_DEMO_LOGIN_ACCOUNTS);
    expect(accounts).toHaveLength(4);
    expect(accounts.map(account => account.staffId)).toEqual(["ci-st8", "ci-st5", "ci-st3", "ci-st7"]);
    expect(accounts.find(account => account.staffId === "ci-st8")).toMatchObject({
      role: "owner",
      email: "a.kone@ecole-ci.edaya.dev",
      initials: "AK",
    });
    expect(accounts.find(account => account.staffId === "ci-st5")).toMatchObject({
      role: "directeur",
      email: "j.aka@ecole-ci.edaya.dev",
      name: "Jean-Baptiste Aka",
      initials: "JA",
    });
    expect(accounts.find(account => account.staffId === "ci-st3")).toMatchObject({
      name: "Mme Assi",
      initials: "MA",
    });
    expect(accounts.find(account => account.staffId === "ci-st7")).toMatchObject({
      role: "educateur",
      email: "m.zongo@ecole-ci.edaya.dev",
      name: "Mme Zongo",
      initials: "MZ",
    });
    expect(accounts.some(account => account.staffId === "ci-st1")).toBe(false);
    expect(accounts.some(account => account.staffId === "ci-st2")).toBe(false);
  });
});
