import { describe, expect, test } from "bun:test";
import { createCoreQueryResolver } from "@/lib/graphql/routes/query-resolvers";
import { coreQueries } from "@/lib/school-api/registry";
import { createTestStaffActor } from "../support/staff-actor-fixture";

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

describe("createCoreQueryResolver", () => {
  test("delegates count queries to the school service", async () => {
    const getOverdueFeeCount = async () => 4;
    const resolver = createCoreQueryResolver(
      coreQueries.find(query => query.methodName === "getOverdueFeeCount")!,
    );

    await expect(resolver({}, {
      input: { schoolId: "school-1" },
    }, resolverContext({ getOverdueFeeCount }))).resolves.toEqual({ count: 4 });
  });

  test("maps school overview input dates before calling the service", async () => {
    const getSchoolOverview = async (input: Record<string, unknown>) => input;
    const resolver = createCoreQueryResolver(
      coreQueries.find(query => query.methodName === "getSchoolOverview")!,
    );

    const result = await resolver({}, {
      input: {
        schoolId: "school-1",
        academicYearId: "year-1",
        academicPeriodId: "period-1",
        referenceDate: "2026-03-01",
      },
    }, resolverContext({ getSchoolOverview })) as Record<string, unknown>;

    expect(result.referenceDate).toEqual(new Date("2026-03-01T00:00:00.000Z"));
  });

  test("serializes timetable event timestamps to ISO strings", async () => {
    const startsAt = new Date("2026-03-01T09:00:00.000Z");
    const endsAt = new Date("2026-03-01T10:00:00.000Z");
    const getClassGroupTimetable = async () => ({
      classGroupId: "class-1",
      events: [{ id: "event-1", startsAt, endsAt, label: "Math" }],
    });
    const resolver = createCoreQueryResolver(
      coreQueries.find(query => query.methodName === "getClassGroupTimetable")!,
    );

    const result = await resolver({}, {
      input: {
        classGroupId: "class-1",
        startDate: "2026-03-01",
        endDate: "2026-03-07",
      },
    }, resolverContext({ getClassGroupTimetable })) as {
      events: Array<{ id: string; startsAt: string; endsAt: string; label: string }>;
    };

    expect(result.events[0]).toEqual({
      id: "event-1",
      label: "Math",
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
  });

  test("serializes teacher timetable event timestamps to ISO strings", async () => {
    const startsAt = new Date("2026-03-01T09:00:00.000Z");
    const endsAt = new Date("2026-03-01T10:00:00.000Z");
    const getTeacherTimetable = async () => ({
      teacherId: "teacher-1",
      events: [{ id: "event-1", startsAt, endsAt, label: "Math" }],
    });
    const resolver = createCoreQueryResolver(
      coreQueries.find(query => query.methodName === "getTeacherTimetable")!,
    );

    const result = await resolver({}, {
      input: {
        teacherId: "teacher-1",
        startDate: "2026-03-01",
        endDate: "2026-03-07",
      },
    }, resolverContext({ getTeacherTimetable })) as {
      events: Array<{ id: string; startsAt: string; endsAt: string; label: string }>;
    };

    expect(result.events[0]).toEqual({
      id: "event-1",
      label: "Math",
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
  });
});
