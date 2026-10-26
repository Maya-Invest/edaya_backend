import type { ActorMetadata } from "@edaya/authorization";
import type { AppBindings } from "@/http/types";
import { PostgresCommandJournal, PostgresDurableWork, PostgresImportStore } from "@edaya/adaptor-postgres";
import { ActorAssuranceLevel, createStaffActorMetadata } from "@edaya/authorization";
import { noOpFileStorage, noOpNotificationGateway } from "@edaya/core";
import { onTestFinished } from "bun:test";
import { Hono } from "hono";
import indexRouter from "@/app-router";
import { ApiSchoolApplication } from "@/lib/school-api/application";
import { parseEnv } from "@/runtime";
import { createAuthorizationDatabase } from "../../../../package/adaptor-postgres/tests/support/authorization-database";

export async function createNativePolicyApp(actor: ActorMetadata | null = createStaffActorMetadata({ schoolId: "school-a", staffMemberId: "staff-a", subjectId: "person-a", academicYearId: "year-a", requestId: "route-policy", authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified })) {
  const fixture = await createAuthorizationDatabase();
  onTestFinished(() => fixture.db.close());
  const school = new ApiSchoolApplication({ repositories: fixture.repositories, importPersistence: new PostgresImportStore(), atomicExecution: fixture.atomic, commandJournal: new PostgresCommandJournal(), durableWork: new PostgresDurableWork(fixture.connection), notificationGateway: noOpNotificationGateway, fileStorage: noOpFileStorage });
  const env = parseEnv({ RUNTIME: "in-memory", NODE_ENV: "test", PORT: 9999, LOG_LEVEL: "silent", DATABASE_URL: "postgres://unused:unused@localhost/test" });
  const app = new Hono<AppBindings>();
  app.use(async (c, next) => {
    c.env = env;
    c.set("actor", actor);
    c.set("schoolApp", school);
    await next();
  });
  app.route("/", indexRouter);
  return { app, school, db: fixture.db, repositories: fixture.repositories };
}
