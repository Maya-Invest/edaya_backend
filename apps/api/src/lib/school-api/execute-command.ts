import type { Context } from "hono";
import type { PublishAnnouncementInput, SchoolCommandKey, SchoolService } from "@edaya/core";
import type { AppBindings } from "@/http/bindings";
import { dispatchSchoolCommand } from "@edaya/core";
import { scheduleBackgroundTask } from "@/lib/school-api/schedule-background-task";

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

  return dispatchSchoolCommand(service.commands, methodName, payload);
}
