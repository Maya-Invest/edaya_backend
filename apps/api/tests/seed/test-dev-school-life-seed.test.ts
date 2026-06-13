import {
  DEV_AUTH_PASSWORD,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  SEED_ABSENCE_RECORDS,
  SEED_CALENDAR_EVENTS,
  SEED_INCIDENTS,
} from "@edaya/dev-fixtures";
import { resetApiRuntimesForTests } from "@/lib/runtime/registry";
import { runDevAccessSeed } from "@/lib/seed/run-dev-access-seed";
import { runDevAuthSeed } from "@/lib/seed/run-dev-auth-seed";
import { runDevSeed } from "@/lib/seed/run-dev-seed";
import {
  collectSetCookieHeaders,
  createAppRequest,
  createCoreRouteTestApp,
} from "../support/better-auth-route-harness";
import { afterEach, describe, expect, it } from "bun:test";

function unwrapEntityList<T>(values: unknown): T[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map((entry) => {
    if (entry && typeof entry === "object" && "data" in entry && Object.keys(entry).length === 1) {
      return (entry as { data: T }).data;
    }
    return entry as T;
  });
}

const expectedCalendarEvents = SEED_CALENDAR_EVENTS.reduce((total, event) => {
  return total + (event.scope === "all" ? 1 : event.scope.length);
}, 0);

import { pgliteEnv } from "../support/pglite-env";

describe("dev school life seed", () => {
  afterEach(async () => {
    await resetApiRuntimesForTests();
  });

  it("seeds calendar, incidents, attendance and lets staff list school-life entities", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    const seedResult = await runDevSeed(application);
    expect(seedResult.status).toBe("seeded");
    if (seedResult.status === "seeded") {
      expect(seedResult.calendarEvents).toBe(expectedCalendarEvents);
      expect(seedResult.incidents).toBe(SEED_INCIDENTS.length);
      expect(seedResult.attendanceRecords).toBe(SEED_ABSENCE_RECORDS.length);
    }

    await runDevAuthSeed(application, runtime.getAuth(), pgliteEnv);
    await runDevAccessSeed(application);

    const signIn = await app.request(createAppRequest("/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL, password: DEV_AUTH_PASSWORD }),
    }));
    const cookies = collectSetCookieHeaders(signIn);
    const authHeaders = {
      "content-type": "application/json",
      "cookie": cookies.join("; "),
    };

    const [calendarResponse, incidentsResponse, attendanceResponse] = await Promise.all([
      app.request(createAppRequest("/core/entities/calendar-events/list", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest("/core/entities/incidents/list", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest("/core/entities/attendance/list", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
    ]);

    expect(calendarResponse.status).toBe(200);
    expect(incidentsResponse.status).toBe(200);
    expect(attendanceResponse.status).toBe(200);

    const calendarEvents = unwrapEntityList<{ id: string; title: string; description?: string }>(await calendarResponse.json());
    const incidents = unwrapEntityList<{ id: string; title: string; kind: string }>(await incidentsResponse.json());
    const attendance = unwrapEntityList<{ id: string; studentId: string }>(await attendanceResponse.json());

    expect(calendarEvents.length).toBeGreaterThanOrEqual(expectedCalendarEvents);
    expect(incidents.length).toBeGreaterThanOrEqual(SEED_INCIDENTS.length);
    expect(attendance.length).toBeGreaterThanOrEqual(SEED_ABSENCE_RECORDS.length);
    expect(calendarEvents.some(event => event.title === "Fête du Travail")).toBe(true);
    expect(calendarEvents.find(event => event.id === "yc3")?.description).toBe(
      "Vacances scolaires de printemps. Réouverture le 4 mai.",
    );
    expect(incidents.some(incident => incident.id === "i1")).toBe(true);
    expect(incidents.find(incident => incident.id === "i1")?.kind).toBe("minor_infraction");
    expect(incidents.find(incident => incident.id === "i2")?.kind).toBe("minor_infraction");
    expect(incidents.find(incident => incident.id === "i3")?.kind).toBe("major_infraction");
    expect(attendance.some(record => record.id === "a1" && record.studentId === "s1")).toBe(true);
  }, 30_000);
});
