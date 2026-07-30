import type { Context } from "hono";
import type { PublishAnnouncementInput, SchoolCommandKey, SchoolService } from "@edaya/service";
import type { AppBindings } from "@/http/bindings";
import { dispatchSchoolCommand } from "@edaya/service";
import { scheduleBackgroundTask } from "@/lib/school-api/schedule-background-task";
import { renderReportCardDocument } from "@/lib/documents/render-report-card-document";

function resolveDocsRenderConfig(env: AppBindings["Bindings"]) {
  if (!env.DOCS_RENDER_ON_PUBLISH) {
    return null;
  }
  if (!env.EDAYA_DOCS_URL) {
    return null;
  }
  if (!env.DOCS_DEV_TOKEN && !env.DOCS_JWT_SECRET) {
    return null;
  }
  return {
    docsUrl: env.EDAYA_DOCS_URL,
    jwtSecret: env.DOCS_JWT_SECRET ?? "",
    ...(env.DOCS_DEV_TOKEN ? { devToken: env.DOCS_DEV_TOKEN } : {}),
  };
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

  if (methodName === "publishReportCardResult") {
    const result = await dispatchSchoolCommand(service.commands, methodName, payload) as { id: string };
    const actor = c.get("actor");
    const docsConfig = resolveDocsRenderConfig(c.env);
    if (actor && docsConfig) {
      scheduleBackgroundTask(c, actor, async (backgroundService) => {
        await renderReportCardDocument(backgroundService, {
          resultId: result.id,
          config: docsConfig,
        });
      });
    }
    return result;
  }

  return dispatchSchoolCommand(service.commands, methodName, payload);
}
