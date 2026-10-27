import type { AppBindings } from "@/http/types";
import { ActorAssuranceLevel, createGuardianActorMetadata } from "@edaya/authorization";
import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import indexRouter from "@/app-router";
import { createReportCardContext } from "../../../../package/domain-service/tests/services/workflows/report-card-workflow-context";

describe("conversation HTTP contract with SQL workflows", () => {
  test("school start, reply, paginated read, immutable history and invalid teacher destination", async () => {
    const fixture = await createReportCardContext();
    const actor = createGuardianActorMetadata({ schoolId: "sch1", academicYearId: "ay1", guardianId: "gua1", subjectId: "subject-gua1", authenticatedAt: new Date(), requestId: "http-test", assuranceLevel: ActorAssuranceLevel.Verified });
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.set("actor", actor);
      c.set("schoolApp", fixture.application as any);
      c.set("logger", { error: () => {} } as any);
      await next();
    });
    app.route("/", indexRouter);
    const post = (path: string, body: unknown) => app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, {} as any);
    const input = { destination: "school", requestId: "http-start", subject: "Opening hours", body: "When do you open?" };
    const first = await post("/core/commands/start-conversation", input);
    expect(first.status).toBe(200);
    const saved = await first.json() as { id: string };
    const retry = await post("/core/commands/start-conversation", input);
    expect((await retry.json() as { id: string }).id).toBe(saved.id);
    const page = await post("/core/queries/list-conversations", { limit: 1 });
    expect(page.status).toBe(200);
    expect((await page.json() as { total: number }).total).toBe(1);
    await fixture.app.conversationsWorkflow.reply({ conversationId: saved.id, expectedVersion: 1, requestId: "http-staff-reply", body: "Eight o’clock." });
    const thread = await post("/core/queries/get-conversation", { conversationId: saved.id, limit: 1 });
    expect(thread.status).toBe(200);
    const data = await thread.json() as { messages: { body: string }[]; hasMore: boolean };
    expect(data.messages[0]?.body).toBe("Eight o’clock.");
    expect(data.hasMore).toBe(true);
    expect((await post("/core/commands/start-conversation", { ...input, destination: "teacher", teacherId: "someone" })).status).toBe(422);
    expect((await post("/core/entities/conversation-messages/save", {})).status).toBe(404);
  });
});
