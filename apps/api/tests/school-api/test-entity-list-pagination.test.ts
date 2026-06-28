import { describe, expect, it } from "bun:test";
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT, normalizeListFilter } from "@/lib/school-api/pagination";

describe("normalizeListFilter", () => {
  it("applies DEFAULT_LIST_LIMIT when $limit is absent", () => {
    expect(normalizeListFilter({ schoolId: "sch-1" })).toEqual({
      schoolId: "sch-1",
      $limit: DEFAULT_LIST_LIMIT,
    });
  });

  it("preserves an explicit $limit", () => {
    expect(normalizeListFilter({ $limit: 10 })).toEqual({ $limit: 10 });
  });

  it("caps explicit $limit at MAX_LIST_LIMIT", () => {
    expect(normalizeListFilter({ $limit: 9999 }).$limit).toBe(MAX_LIST_LIMIT);
  });
});
