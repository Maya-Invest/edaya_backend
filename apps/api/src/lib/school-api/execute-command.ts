import type { PublishAnnouncementInput, SchoolCommandKey, SchoolService } from "@edaya/service";
import type { Context } from "hono";
import type { AppBindings } from "@/http/bindings";
import { dispatchConversationNotifications, dispatchDocumentRender, dispatchGradingRecalculation, dispatchSchoolCommand } from "@edaya/service";
import { scheduleBackgroundApplicationTask, scheduleBackgroundTask } from "@/lib/school-api/schedule-background-task";

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
  scheduleBackgroundApplicationTask(c, application => dispatchDocumentRender(application));
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
  if (methodName === "startConversation" || methodName === "replyConversation")
    scheduleBackgroundApplicationTask(c, application => dispatchConversationNotifications(application));
  if (methodName === "configureGrading" || methodName === "retryGrading")
    scheduleBackgroundApplicationTask(c, application => dispatchGradingRecalculation(application));
  if (DOCUMENT_NUDGE_COMMANDS.has(methodName)) {
    nudgeDocumentRender(c);
  }
  return result;
}
