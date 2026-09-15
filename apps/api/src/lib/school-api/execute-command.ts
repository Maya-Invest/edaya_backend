import type { Context } from "hono";
import type { PublishAnnouncementInput, SchoolCommandKey, SchoolService } from "@edaya/service";
import type { AppBindings } from "@/http/bindings";
import { dispatchDocumentRender, dispatchSchoolCommand } from "@edaya/service";
import { scheduleBackgroundTask } from "@/lib/school-api/schedule-background-task";

const DOCUMENT_NUDGE_COMMANDS = new Set<SchoolCommandKey>([
  "publishReportCardResult",
  "requestDocumentIssuance",
  "requestDocumentIssuanceBatch",
  "retryDocumentIssuance",
  "correctDocumentIssuance",
  "previewDocument",
  "renderClassLogbook",
]);

function nudgeDocumentRender(c: Context<AppBindings>): void {
  const application = c.get("schoolApp");
  const run = Promise.resolve()
    .then(() => dispatchDocumentRender(application))
    .catch((error) => {
      c.var.logger?.error?.({ err: error }, "document render nudge failed");
    });
  if (c.env.RUNTIME === "worker") {
    c.executionCtx.waitUntil(run);
    return;
  }
  void run;
}

export async function executeSchoolCommand(
  c: Context<AppBindings>,
  service: SchoolService,
  methodName: SchoolCommandKey,
  payload: unknown,
): Promise<unknown> {
  if (methodName === "publishAnnouncement") {
    const input = payload as PublishAnnouncementInput;
    const announcement = await service.communicationsWorkflow.publishAnnouncement(input, {
      deferNotifications: true,
    });
    const actor = c.get("actor");
    if (actor) {
      scheduleBackgroundTask(c, actor, async (backgroundService) => {
        await backgroundService.communicationsWorkflow.dispatchPublishedAnnouncementNotifications(
          input.announcementId,
        );
      });
    }
    return announcement;
  }

  const result = await dispatchSchoolCommand(service.commands, methodName, payload);
  if (DOCUMENT_NUDGE_COMMANDS.has(methodName)) {
    nudgeDocumentRender(c);
  }
  return result;
}
