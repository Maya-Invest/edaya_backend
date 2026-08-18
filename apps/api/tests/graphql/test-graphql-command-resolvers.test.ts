import { describe, expect, mock, test } from "bun:test";
import { createCommandMutationResolver } from "@/lib/graphql/routes/command-resolvers";
import { coreCommands } from "@/lib/school-api/registry";
import { createTestStaffActor } from "../support/staff-actor-fixture";

const publishAcademicYear = coreCommands.find(command => command.methodName === "publishAcademicYear")!;
const linkActorSubject = coreCommands.find(command => command.methodName === "linkActorSubject")!;

function resolverContext(service: Record<string, unknown>) {
  const actor = createTestStaffActor();

  return {
    get(key: string) {
      if (key === "actor") {
        return actor;
      }
      if (key === "schoolApp") {
        return { forActor: () => service };
      }
      return undefined;
    },
  } as never;
}

describe("createCommandMutationResolver", () => {
  test("returns a completion message when the command result is empty", async () => {
    const publishAcademicYearCommand = mock(async () => undefined);
    const resolver = createCommandMutationResolver(publishAcademicYear);

    await expect(resolver({}, {
      input: { academicYearId: "year-1" },
    }, resolverContext({
      commands: { publishAcademicYear: publishAcademicYearCommand },
    }))).resolves.toEqual({
      message: "publish-academic-year completed",
    });
  });

  test("serializes entity results returned from commands", async () => {
    const linkActorSubjectCommand = mock(async () => ({
      kind: "teacher",
      entity: { data: { id: "teacher-1", subjectId: "auth-1" } },
    }));
    const resolver = createCommandMutationResolver(linkActorSubject);

    await expect(resolver({}, {
      input: { actorKind: "teacher", actorId: "teacher-1", subjectId: "auth-1" },
    }, resolverContext({
      commands: { linkActorSubject: linkActorSubjectCommand },
    }))).resolves.toEqual({
      kind: "teacher",
      entity: { id: "teacher-1", subjectId: "auth-1" },
    });
  });
});
