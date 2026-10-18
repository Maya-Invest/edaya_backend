import { describe, expect, it } from "bun:test";
import { subjectConfigCommandSchema, updateSubjectCommandSchema } from "../../src/lib/school-api/schemas/commands";

describe("subject edit command", () => {
  it("does not invent defaults for omitted update fields", () => {
    expect(updateSubjectCommandSchema.parse({ subjectId: "gls-6-math", coefficient: 2 }))
      .toEqual({ subjectId: "gls-6-math", coefficient: 2 });
  });

  it("accepts metadata and workload clears in one command", () => {
    const input = {
      subjectId: "gls-6-math",
      name: "Mathematics",
      categoryId: "science",
      color: "sky",
      periodsPerWeek: 4,
      minPeriodSpan: null,
      maxPeriodSpan: null,
    } as const;
    expect(updateSubjectCommandSchema.parse(input)).toEqual(input);
  });

  it("rejects invalid workload values and colors at the API boundary", () => {
    for (const change of [{ periodsPerWeek: 0 }, { minPeriodSpan: -1 }, { maxPeriodSpan: 1.5 }, { color: "invalid" }]) {
      expect(updateSubjectCommandSchema.safeParse({ subjectId: "gls-6-math", ...change }).success).toBe(false);
    }
  });

  it("preserves every explicit clear in update and configure commands", () => {
    const clears = { shortName: null, code: null, coefficient: null, periodsPerWeek: null, minPeriodSpan: null, maxPeriodSpan: null };
    expect(updateSubjectCommandSchema.parse({ subjectId: "math-6", ...clears })).toEqual({ subjectId: "math-6", ...clears });
    const configured = subjectConfigCommandSchema.parse({ id: "math-6", gradeLevelId: "grade-6", academicYearId: "year", name: "Math", categoryId: "science", ...clears });
    expect(configured).toMatchObject(clears);
    expect(configured).not.toHaveProperty("color");
    expect(configured).not.toHaveProperty("isOptional");
  });
});
