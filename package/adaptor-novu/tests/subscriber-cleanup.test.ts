import { describe, expect, test } from "bun:test";
import type { NovuSubscriberSnapshot } from "../src/subscriber-cleanup";
import {
  matchesSubscriberCleanupSelector,
  selectNovuSubscribersForCleanup,
  TRANSIENT_INVITATION_SUBSCRIBER_PREFIX,
} from "../src/subscriber-cleanup";

function snapshot(subscriberId: string, deleted = false): NovuSubscriberSnapshot {
  return { subscriberId, deleted };
}

describe("matchesSubscriberCleanupSelector", () => {
  test("matches transient invitation subscribers", () => {
    expect(matchesSubscriberCleanupSelector(
      snapshot(`${TRANSIENT_INVITATION_SUBSCRIBER_PREFIX}inv-1`),
      { transientInvites: true },
    )).toBe(true);
    expect(matchesSubscriberCleanupSelector(
      snapshot("auth-g1"),
      { transientInvites: true },
    )).toBe(false);
  });

  test("matches prefix and explicit ids", () => {
    expect(matchesSubscriberCleanupSelector(
      snapshot("smoke-user-1"),
      { prefix: "smoke-" },
    )).toBe(true);
    expect(matchesSubscriberCleanupSelector(
      snapshot("auth-g1"),
      { ids: ["auth-g1", "auth-g2"] },
    )).toBe(true);
  });

  test("ignores deleted subscribers", () => {
    expect(matchesSubscriberCleanupSelector(
      snapshot("invite:inv-1", true),
      { transientInvites: true },
    )).toBe(false);
  });
});

describe("selectNovuSubscribersForCleanup", () => {
  test("selects all active subscribers when --all", () => {
    const selected = selectNovuSubscribersForCleanup([
      snapshot("auth-g1"),
      snapshot("invite:inv-1"),
      snapshot("deleted-user", true),
    ], { all: true });

    expect(selected.map(entry => entry.subscriberId)).toEqual([
      "auth-g1",
      "invite:inv-1",
    ]);
  });
});
