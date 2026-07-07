import { describe, expect, test } from "bun:test";
import { Permission } from "@edaya/core";
import { serializeEffectiveGrants } from "@/lib/authorization/serialize-grants";

describe("serializeEffectiveGrants", () => {
  test("serializes scopeIdsByPermission without deriving scopeGrants", () => {
    const serialized = serializeEffectiveGrants({
      permissions: new Set([Permission.QUERY_STUDENT_DETAIL_READ]),
      scopeGrants: [],
      scopeIdsByPermission: {
        [Permission.QUERY_STUDENT_DETAIL_READ]: "s1,s2",
      },
      isElevated: false,
    });

    expect(serialized.scopeIdsByPermission).toEqual({
      QUERY_STUDENT_DETAIL_READ: "s1,s2",
    });
    expect(serialized.scopeGrants).toEqual([]);
  });

  test("passes through persisted scopeGrants", () => {
    const serialized = serializeEffectiveGrants({
      permissions: new Set([Permission.STUDENT_READ]),
      scopeGrants: [{
        permission: Permission.STUDENT_READ,
        scopeType: "school",
        scopeEntityIds: ["school-1"],
      }],
      scopeIdsByPermission: {},
      isElevated: false,
    });

    expect(serialized.scopeGrants).toEqual([{
      permission: Permission.STUDENT_READ,
      scopeType: "school",
      scopeEntityIds: ["school-1"],
    }]);
    expect(serialized.scopeIdsByPermission).toEqual({});
  });
});
