import { describe, expect, it } from "bun:test";
import { updateGradeLevelSubjectCommandSchema } from "../../src/lib/school-api/schemas/commands";

describe("subject edit command", () => {
  it("keeps existing allocation-only callers compatible without inventing a color", () => {
    expect(updateGradeLevelSubjectCommandSchema.parse({ gradeLevelSubjectId: "gls-6-math", coefficient: 2 }))
      .toEqual({ gradeLevelSubjectId: "gls-6-math", coefficient: 2 });
  });

  it("accepts metadata and workload clears in one command", () => {
    const input = {
      gradeLevelSubjectId: "gls-6-math",
      name: "Mathematics",
      categoryId: "science",
      color: "sky",
      periodsPerWeek: 4,
      minPeriodSpan: null,
      maxPeriodSpan: null,
    } as const;
    expect(updateGradeLevelSubjectCommandSchema.parse(input)).toEqual(input);
  });

  it("rejects invalid workload values and colors at the API boundary", () => {
    for (const change of [{ periodsPerWeek: 0 }, { minPeriodSpan: -1 }, { maxPeriodSpan: 1.5 }, { color: "invalid" }]) {
      expect(updateGradeLevelSubjectCommandSchema.safeParse({ gradeLevelSubjectId: "gls-6-math", ...change }).success).toBe(false);
    }
  });
});
