import { describe, expect, test } from "bun:test";
import { buildNovuTriggerSubscriber, splitDisplayName } from "../src/trigger-recipient";

describe("splitDisplayName", () => {
  test("splits first and remaining names", () => {
    expect(splitDisplayName("Ada Owner")).toEqual({ firstName: "Ada", lastName: "Owner" });
    expect(splitDisplayName("Paul")).toEqual({ firstName: "Paul" });
    expect(splitDisplayName("  ")).toEqual({});
  });
});

describe("buildNovuTriggerSubscriber", () => {
  test("includes email on the trigger recipient", () => {
    expect(buildNovuTriggerSubscriber({
      subscriberId: "invite:inv-1",
      email: "user@school.edu",
      displayName: "Paul Martin",
    })).toEqual({
      subscriberId: "invite:inv-1",
      email: "user@school.edu",
      firstName: "Paul",
      lastName: "Martin",
    });
  });
});
