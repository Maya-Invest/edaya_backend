import { describe, expect, it } from "vitest";

import { commandRoutePairs } from "@/routes/commands/commands.route";
import { configCommandEntities } from "@/routes/commands/commands.config";
import { queryableEntities } from "@/routes/queries/queries.config";
import { queryRoutePairs } from "@/routes/queries/queries.route";
import { getQueryOptionFields } from "@/validation/utils/query-options";

function fieldsFor(entityName: string): readonly string[] {
  const entity = queryableEntities.find(candidate => candidate.name === entityName);
  if (!entity) {
    throw new Error(`Missing queryable entity ${entityName}`);
  }

  return getQueryOptionFields(entity.querySchema);
}

describe("generated route registry contracts", () => {
  it("should generate four query endpoints for every queryable entity", () => {
    expect(queryRoutePairs).toHaveLength(queryableEntities.length * 4);
  });

  it("should generate create and delete command endpoints for every config command entity", () => {
    expect(commandRoutePairs).toHaveLength(configCommandEntities.length * 2);
  });

  it("should not register duplicate query or command entity names", () => {
    const queryNames = queryableEntities.map(entity => entity.name);
    const commandNames = configCommandEntities.map(entity => entity.name);

    expect(new Set(queryNames).size).toBe(queryNames.length);
    expect(new Set(commandNames).size).toBe(commandNames.length);
  });

  it("should expose current domain field names for known drift-prone query filters", () => {
    expect(fieldsFor("resources")).toContain("kind");
    expect(fieldsFor("resources")).not.toContain("type");

    expect(fieldsFor("payments")).toContain("method");
    expect(fieldsFor("payments")).not.toContain("paymentMethod");

    expect(fieldsFor("schedules")).toContain("title");
    expect(fieldsFor("schedules")).not.toContain("name");

    expect(fieldsFor("assessments")).toContain("title");
    expect(fieldsFor("assessments")).not.toContain("name");

    expect(fieldsFor("announcementTargets")).toContain("targetKind");
    expect(fieldsFor("announcementTargets")).not.toContain("targetType");

    expect(fieldsFor("messageDeliveries")).toContain("announcementId");
    expect(fieldsFor("messageDeliveries")).not.toContain("messageId");
  });
});
