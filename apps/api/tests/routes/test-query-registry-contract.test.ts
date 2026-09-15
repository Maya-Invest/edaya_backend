import { permitsPublicSave } from "@/lib/school-api/public-operations";
import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { CORE_ENTITY_KEYS } from "@edaya/service";
import { coreCommands, coreEntities, coreQueries } from "@/lib/school-api/registry";
import { commandMessageResponseSchema, commandResponseByMethod } from "@/lib/school-api/schemas/command-responses";
import { getQueryOptionFields } from "@/lib/school-api/schemas/helpers";
import { buildCoreRoutes } from "@/lib/school-api/routes";

const coreRoutePairs = buildCoreRoutes();

function keyDifference(actual: readonly string[], expected: readonly string[]) {
  const actualKeys = new Set(actual);
  const expectedKeys = new Set(expected);
  return {
    missing: expected.filter(key => !actualKeys.has(key)),
    extra: actual.filter(key => !expectedKeys.has(key)),
  };
}

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
  it("covers every core managed entity exactly once", () => {
    const serviceNames = coreEntities.map(entity => entity.serviceName);

    expect(keyDifference(serviceNames, CORE_ENTITY_KEYS)).toEqual({
      missing: [],
      extra: [],
    });
    expect(new Set(serviceNames).size).toBe(serviceNames.length);
  });

  it("defines complete route policy metadata for every entity", () => {
    const incomplete = coreEntities
      .filter(entity =>
        !entity.publicName
        || !entity.displayName
        || !entity.querySchema
        || !entity.responseSchema
        || !entity.saveSchema
        || Object.values(entity.publicOperations).some(value => typeof value !== "boolean")
        || typeof entity.createEntity !== "function",
      )
      .map(entity => entity.serviceName);

    expect(incomplete).toEqual([]);
    for (const entity of coreEntities) {
      expect(entity.saveSchema).toBe(entity.responseSchema);
    }
  });

  it("omits unavailable generic writes while retaining named commands", () => {
    const paths = new Set(coreRoutePairs.map(({ route }) => route.path));
    for (const name of ["attachments", "students", "enrollments", "payments", "student-charges", "catalog-services", "student-year-accounts", "student-service-enrollments", "assessment-results", "results", "account-invitations"]) {
      for (const action of ["save", "delete", "batch-save", "batch-delete"]) {
        expect(paths.has(`/core/entities/${name}/${action}`)).toBe(false);
      }
      expect(paths.has(`/core/entities/${name}/list`)).toBe(true);
    }
    expect(paths.has("/core/commands/record-payment")).toBe(true);
    expect(paths.has("/core/commands/cancel-student-fee")).toBe(true);
    expect(paths.has("/core/entities/class-subjects/save")).toBe(false);
    expect(paths.has("/core/entities/class-subjects/delete")).toBe(true);
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
    const commandOnlyEntities = coreEntities.filter(entity => !permitsPublicSave(entity.publicOperations));
    expect(commandOnlyEntities.map(entity => entity.serviceName)).toEqual(expect.arrayContaining([
      "students",
      "enrollments",
      "studentCharges",
      "attachments",
      "payments",
      "assessmentResults",
      "results",
    ]));
  });

  it("exposes current domain field names for known drift-prone query filters", () => {
    expect(fieldsFor("staffPermissionAssignments")).toEqual(expect.arrayContaining([
      "staffId",
      "schoolId",
      "academicYearId",
      "status",
    ]));

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
