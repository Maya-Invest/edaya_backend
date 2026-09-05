import type { Context } from "hono";
import type { PublishAnnouncementInput, SchoolCommandKey, SchoolService } from "@edaya/service";
import type { AppBindings } from "@/http/bindings";
import { BusinessRuleViolationError } from "@edaya/core";
import { dispatchSchoolCommand } from "@edaya/service";
import { scheduleBackgroundTask } from "@/lib/school-api/schedule-background-task";
import { renderClassLogbookDocument } from "@/lib/documents/render-logbook-document";
import { renderReportCardDocument } from "@/lib/documents/render-report-card-document";

function resolveDocsRenderConfig(env: AppBindings["Bindings"], options?: {
  requirePublishFlag?: boolean;
}) {
  if (options?.requirePublishFlag && !env.DOCS_RENDER_ON_PUBLISH) {
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

function localeFromRequest(c: Context<AppBindings>): string {
  const header = c.req.header("accept-language") ?? "";
  return header.toLowerCase().startsWith("en") ? "en-US" : "fr-FR";
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
    const docsConfig = resolveDocsRenderConfig(c.env, { requirePublishFlag: true });
    if (actor && docsConfig) {
      scheduleBackgroundTask(c, actor, async (backgroundService) => {
        await renderReportCardDocument(backgroundService, {
          resultId: result.id,
          config: docsConfig,
          locale: localeFromRequest(c),
        });
      });
    }
    return result;
  }

  if (methodName === "renderClassLogbook") {
    const docsConfig = resolveDocsRenderConfig(c.env);
    if (!docsConfig) {
      throw new BusinessRuleViolationError(
        "DOCS_NOT_CONFIGURED",
        "Document rendering is not configured (EDAYA_DOCS_URL + DOCS_JWT_SECRET)",
      );
    }
    const input = payload as {
      classGroupId: string;
      academicPeriodId?: string;
      classSubjectId?: string;
      locale?: "fr" | "en";
    };
    return renderClassLogbookDocument(service, {
      classGroupId: input.classGroupId,
      academicPeriodId: input.academicPeriodId,
      classSubjectId: input.classSubjectId,
      locale: input.locale === "en" ? "en-GB" : "fr-FR",
      config: docsConfig,
    });
  }

  return dispatchSchoolCommand(service.commands, methodName, payload);
}
