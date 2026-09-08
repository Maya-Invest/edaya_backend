import type { Context } from "hono";
import type { PublishAnnouncementInput, SchoolCommandKey, SchoolService } from "@edaya/service";
import type { AppBindings } from "@/http/bindings";
import { BusinessRuleViolationError } from "@edaya/core";
import { dispatchSchoolCommand } from "@edaya/service";
import { scheduleBackgroundTask } from "@/lib/school-api/schedule-background-task";
import { renderClassLogbookDocument } from "@/lib/documents/render-logbook-document";
import { renderReportCardDocument } from "@/lib/documents/render-report-card-document";
import { resolveDocumentRenderer } from "@/runtime/shared/adapters/document-renderer";

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
    const renderer = c.env.DOCS_RENDER_ON_PUBLISH
      ? resolveDocumentRenderer(c.env)
      : undefined;
    if (actor && renderer) {
      scheduleBackgroundTask(c, actor, async (backgroundService) => {
        await renderReportCardDocument(backgroundService, {
          resultId: result.id,
          renderer,
          locale: localeFromRequest(c),
        });
      });
    }
    return result;
  }

  if (methodName === "renderClassLogbook") {
    const renderer = resolveDocumentRenderer(c.env);
    if (!renderer) {
      throw new BusinessRuleViolationError(
        "DOCS_NOT_CONFIGURED",
        "Document rendering is not configured",
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
      renderer,
    });
  }

  return dispatchSchoolCommand(service.commands, methodName, payload);
}
