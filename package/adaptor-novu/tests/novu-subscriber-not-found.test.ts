import { describe, expect, test } from "bun:test";
import { isNovuSubscriberNotFoundError } from "../src/errors";

describe("isNovuSubscriberNotFoundError", () => {
  test("matches Novu subscriber delete 404 responses", () => {
    expect(isNovuSubscriberNotFoundError(Object.assign(
      new Error("Subscriber was not found"),
      { statusCode: 404 },
    ))).toBe(true);
  });

  test("ignores unrelated errors", () => {
    expect(isNovuSubscriberNotFoundError(new Error("Subscriber was not found"))).toBe(true);
    expect(isNovuSubscriberNotFoundError(new Error("Network timeout"))).toBe(false);
    expect(isNovuSubscriberNotFoundError(null)).toBe(false);
  });
});
