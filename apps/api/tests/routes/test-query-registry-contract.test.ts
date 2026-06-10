import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { coreCommands, coreEntities, coreQueries } from "@/lib/school-api/registry";
import { commandMessageResponseSchema, commandResponseByMethod } from "@/lib/school-api/schemas/openapi/command-response.schemas";
import { getQueryOptionFields } from "@/lib/school-api/schemas/openapi/utils/query-options";
import { buildCommandRoutes } from "@/routes/commands.routes";
import { buildEntityRoutes } from "@/routes/entities.routes";
import { buildQueryRoutes } from "@/routes/queries.routes";

const coreRoutePairs = [
  ...buildCommandRoutes(),
  ...buildQueryRoutes(),
  ...buildEntityRoutes(),
];

function fieldsFor(entityName: string): readonly string[] {
  const entity = coreEntities.find(candidate => candidate.serviceName === entityName);
  if (!entity) {
    throw new Error(`Missing queryable entity ${entityName}`);
  }

  return getQueryOptionFields(entity.querySchema);
}

function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      return listSourceFiles(path);
    }
    return path.endsWith(".ts") ? [path] : [];
  });
}

describe("core route registry contracts", () => {
  it("generates command, query, and eight entity endpoints for every core registry entry", () => {
    expect(coreRoutePairs).toHaveLength(
      coreCommands.length + coreQueries.length + coreEntities.length * 8,
    );
  });

  it("does not register duplicate public route names", () => {
    const commandNames = coreCommands.map(command => command.publicName);
    const queryNames = coreQueries.map(query => query.publicName);
    const entityNames = coreEntities.map(entity => entity.publicName);
    const routePaths = coreRoutePairs.map(({ route }) => route.path);

    expect(new Set(commandNames).size).toBe(commandNames.length);
    expect(new Set(queryNames).size).toBe(queryNames.length);
    expect(new Set(entityNames).size).toBe(entityNames.length);
    expect(new Set(routePaths).size).toBe(routePaths.length);
  });

  it("uses kebab-case public names", () => {
    const publicNames = [
      ...coreCommands.map(command => command.publicName),
      ...coreQueries.map(query => query.publicName),
      ...coreEntities.map(entity => entity.publicName),
    ];

    for (const publicName of publicNames) {
      expect(publicName).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
    }
  });

  it("registers typed OpenAPI response schemas for every command", () => {
    for (const command of coreCommands) {
      expect(commandResponseByMethod[command.methodName]).toBeDefined();
      expect(command.responseSchema).toBeDefined();
    }

    expect(commandResponseByMethod.removeResourceAssignment).toBe(commandMessageResponseSchema);
    expect(commandResponseByMethod.removeAttachment).toBe(commandMessageResponseSchema);
    expect(commandResponseByMethod.registerStudent).not.toBe(commandMessageResponseSchema);
  });

  it("marks command-only entities as disallowing direct save", () => {
    const commandOnlyEntities = coreEntities.filter(entity => !entity.allowDirectSave);
    expect(commandOnlyEntities.map(entity => entity.serviceName)).toEqual(expect.arrayContaining([
      "students",
      "enrollments",
      "studentFees",
      "payments",
      "assessmentResults",
      "results",
    ]));
  });

  it("exposes current domain field names for known drift-prone query filters", () => {
    expect(fieldsFor("accessRoles")).toEqual(expect.arrayContaining(["schoolId", "status", "name"]));
    expect(fieldsFor("staffRoleAssignments")).toEqual(expect.arrayContaining(["staffId", "schoolId", "status"]));

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

  it("does not import the removed API school service facade from source", () => {
    const sourceFiles = listSourceFiles(join(process.cwd(), "src"));
    const offenders = sourceFiles.filter(file =>
      readFileSync(file, "utf8").includes("school-service-facade"),
    );

    expect(offenders).toEqual([]);
  });
});
