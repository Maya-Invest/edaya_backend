import type { AppShellCounts, ClassGroupTimetable, GetAppShellCountsInput, GetClassGroupTimetableInput, GetSchoolOverviewInput, GetTeacherTimetableInput, ResolveTimetableSpaceInput, TeacherTimetable } from "@edaya/service";
import type { SchoolApiRoutePair } from "./shared";
import type { AppRouteHandler } from "@/http/types";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreQueries } from "@/lib/school-api/registry";
import { schoolApiPath } from "./paths";
import { coreRouteErrorResponses, validatedJson } from "./shared";

export function buildQueryRoutes(): SchoolApiRoutePair[] {
  const pairs: SchoolApiRoutePair[] = [];

  coreQueries.forEach((queryConfig) => {
    const route = createRoute({
      method: "post",
      path: schoolApiPath("queries", queryConfig.publicName),
      tags: ["Core Queries"],
      summary: queryConfig.publicName,
      ...queryRouteOperation(queryConfig),
      request: {
        body: jsonContent(queryConfig.requestSchema, `${queryConfig.publicName} payload`),
      },
      responses: {
        [HttpStatusCodes.OK]: jsonContent(queryConfig.responseSchema, `Resolved ${queryConfig.publicName}`),
        ...coreRouteErrorResponses,
      },
    });

    const handler: AppRouteHandler<typeof route> = async (c) => {
      const actor = c.get("actor");
      if (!actor) {
        return unauthorizedResponse(c);
      }

      const service = c.get("schoolApp").forActor(actor);
      const payload = validatedJson(c) as Record<string, unknown>;

      try {
        if (queryConfig.methodName === "getAssessmentMarksReview")
          return c.json(await service.getAssessmentMarksReview({ assessmentId: payload.assessmentId as string }), HttpStatusCodes.OK);
        if (queryConfig.methodName === "listAssessmentMarksReviews")
          return c.json(await service.listAssessmentMarksReviews(payload as Parameters<typeof service.listAssessmentMarksReviews>[0]), HttpStatusCodes.OK);
        if (queryConfig.methodName === "getSchoolOverview") {
          const input: GetSchoolOverviewInput = {
            schoolId: payload.schoolId as string,
            academicYearId: payload.academicYearId as string,
            academicPeriodId: payload.academicPeriodId as string,
            referenceDate: payload.referenceDate
              ? new Date(`${payload.referenceDate as string}T00:00:00.000Z`)
              : undefined,
          };
          const overview = await service.getSchoolOverview(input);
          return c.json(overview, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getAppShellCounts") {
          const input: GetAppShellCountsInput = {
            schoolId: payload.schoolId as string,
            ...(Array.isArray(payload.classGroupIds)
              ? { classGroupIds: payload.classGroupIds as string[] }
              : {}),
          };
          const counts: AppShellCounts = await service.getAppShellCounts(input);
          return c.json(counts, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getClassGroupTimetable") {
          const input: GetClassGroupTimetableInput = {
            classGroupId: payload.classGroupId as string,
            startDate: new Date(`${payload.startDate as string}T00:00:00.000Z`),
            endDate: new Date(`${payload.endDate as string}T00:00:00.000Z`),
          };
          const timetable = await service.getClassGroupTimetable(input);
          return c.json(serializeTimetable(timetable), HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getTeacherTimetable") {
          const input: GetTeacherTimetableInput = {
            teacherId: payload.teacherId as string,
            startDate: new Date(`${payload.startDate as string}T00:00:00.000Z`),
            endDate: new Date(`${payload.endDate as string}T00:00:00.000Z`),
          };
          const timetable = await service.getTeacherTimetable(input);
          return c.json(serializeTimetable(timetable), HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "resolveTimetableSpace") {
          const input: ResolveTimetableSpaceInput = {
            classGroupId: payload.classGroupId as string,
            academicYearId: payload.academicYearId as string,
            startDate: new Date(`${payload.startDate as string}T00:00:00.000Z`),
            endDate: new Date(`${payload.endDate as string}T00:00:00.000Z`),
          };
          const cells = await service.resolveTimetableSpace(input);
          return c.json(cells.map(cell => ({
            ...cell,
            startsAt: cell.startsAt.toISOString(),
            endsAt: cell.endsAt.toISOString(),
          })), HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getStudentFinanceSummary") {
          const summary = await service.getStudentFinanceSummary({
            studentId: payload.studentId as string,
            academicYearId: payload.academicYearId as string,
          });
          return c.json(serializeFinanceSummary(summary), HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getAccountStatement") {
          return c.json(serializeAccountStatement(await service.getAccountStatement({
            accountId: payload.accountId as string,
          })), HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getSchoolFinanceAging") {
          return c.json(await service.getSchoolFinanceAging({
            schoolId: payload.schoolId as string,
            academicYearId: payload.academicYearId as string | undefined,
          }), HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getFinanceReconciliation") {
          return c.json(await service.getFinanceReconciliation({
            schoolId: payload.schoolId as string,
            academicYearId: payload.academicYearId as string | undefined,
          }), HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "previewAccountAllocation") {
          const allocation = payload.allocation as { mode: "account_only" | "fifo" | "targeted"; targets?: { chargeId: string; amount: number }[] };
          return c.json(await service.previewAccountAllocation({
            accountId: payload.accountId as string,
            allocation: allocation.mode === "targeted"
              ? { mode: "targeted", targets: allocation.targets ?? [] }
              : { mode: allocation.mode },
          }), HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getRelatedFamilyFinanceOverview") {
          const overview = await service.getRelatedFamilyFinanceOverview({
            academicYearId: payload.academicYearId as string,
          });
          return c.json({
            academicYearId: overview.academicYearId,
            students: overview.students.map(serializeFinanceSummary),
          }, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getStudentAccountStatement") {
          const statement = await service.getStudentAccountStatement({
            studentId: payload.studentId as string,
            academicYearId: payload.academicYearId as string,
            currency: payload.currency as string | undefined,
          });
          return c.json(statement ? serializeAccountStatement(statement) : null, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "listOpenDueCharges") {
          return c.json(await service.listOpenDueCharges({
            schoolId: payload.schoolId as string,
            academicYearId: payload.academicYearId as string | undefined,
          }), HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getPaymentSettlementHistory") {
          return c.json(await service.getPaymentSettlementHistory({
            accountId: payload.accountId as string,
          }), HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "reconcileStudentYearAccount") {
          return c.json(await service.reconcileStudentYearAccount({
            accountId: payload.accountId as string,
          }), HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "reconcileSchoolFinance") {
          return c.json(await service.reconcileSchoolFinance({
            schoolId: payload.schoolId as string,
            academicYearId: payload.academicYearId as string | undefined,
          }), HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "listDocumentTemplates") {
          return c.json(await service.listDocumentTemplates() as never, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "listDocumentIssuances") {
          return c.json(await service.listDocumentIssuances({
            studentId: payload.studentId as string | undefined,
            academicYearId: payload.academicYearId as string | undefined,
            classGroupId: payload.classGroupId as string | undefined,
            templateKey: payload.templateKey as never,
            sourceId: payload.sourceId as string | undefined,
            status: payload.status as never,
          }) as never, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getDocumentIssuance") {
          return c.json(await service.getDocumentIssuance({ id: payload.id as string }), HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "grantDocumentDownload") {
          const grant = await service.grantDocumentDownload({ id: payload.id as string });
          return c.json(serializeDocumentDownload(grant), HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "grantDocumentBundleDownload") {
          const bundle = await service.grantDocumentBundleDownload({
            issuanceIds: payload.issuanceIds as string[],
          });
          return c.json({ items: bundle.items.map(serializeDocumentDownload) }, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "listFamilyFeedbackCampaigns") {
          return c.json(await service.listFamilyFeedbackCampaigns() as never, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getFamilyFeedbackCampaign") {
          return c.json(await service.getFamilyFeedbackCampaign({ id: payload.id as string }) as never, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "previewFamilyFeedbackAudience") {
          return c.json(await service.previewFamilyFeedbackAudience({
            id: payload.id as string | undefined,
            academicYearId: payload.academicYearId as string,
            academicPeriodId: payload.academicPeriodId as string,
            teacherAssignmentId: payload.teacherAssignmentId as string,
          }) as never, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getFamilyFeedbackInstrument") {
          return c.json(await service.getFamilyFeedbackInstrument({ locale: payload.locale as "fr" | "en" }) as never, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "listGuardianFamilyFeedbackCampaigns") {
          return c.json(await service.listGuardianFamilyFeedbackCampaigns() as never, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getGuardianFamilyFeedbackQuestionnaire") {
          return c.json(await service.getGuardianFamilyFeedbackQuestionnaire({
            campaignId: payload.campaignId as string,
            studentId: payload.studentId as string,
            locale: payload.locale as "fr" | "en",
          }) as never, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "listFamilyFeedbackComments") {
          return c.json(await service.listFamilyFeedbackComments({ id: payload.id as string }) as never, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getFamilyFeedbackAggregateReview") {
          return c.json(await service.getFamilyFeedbackAggregateReview({ id: payload.id as string }) as never, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "listTeacherFamilyFeedbackResults") {
          return c.json(await service.listTeacherFamilyFeedbackResults() as never, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getTeacherFamilyFeedbackResult") {
          return c.json(await service.getTeacherFamilyFeedbackResult({ id: payload.id as string }) as never, HttpStatusCodes.OK);
        }

        if (queryConfig.methodName === "getTeacherCorrection")
          return c.json(await service.getTeacherCorrection(payload as unknown as Parameters<typeof service.getTeacherCorrection>[0]) as never, HttpStatusCodes.OK);
        if (queryConfig.methodName === "listTeacherCorrections")
          return c.json(await service.listTeacherCorrections(payload as unknown as Parameters<typeof service.listTeacherCorrections>[0]) as never, HttpStatusCodes.OK);
        if (queryConfig.methodName === "getTeacherAttendanceCall")
          return c.json(await service.getTeacherAttendanceCall(payload as unknown as Parameters<typeof service.getTeacherAttendanceCall>[0]) as never, HttpStatusCodes.OK);
        if (queryConfig.methodName === "getTeacherWorkflowState")
          return c.json(await service.getTeacherWorkflowState(payload as unknown as Parameters<typeof service.getTeacherWorkflowState>[0]) as never, HttpStatusCodes.OK);
        const count = await service[queryConfig.methodName](payload.schoolId as string);
        return c.json({ count }, HttpStatusCodes.OK);
      }
      catch (err) {
        return routeErrorResponse(c, err);
      }
    };

    pairs.push({ route, handler });
  });

  return pairs;
}

function serializeDocumentDownload(grant: Awaited<ReturnType<import("@edaya/service").SchoolService["grantDocumentDownload"]>>) {
  return {
    downloadUrl: grant.downloadUrl,
    expiresAt: grant.expiresAt instanceof Date ? grant.expiresAt.toISOString() : grant.expiresAt,
    fileName: grant.fileName,
    issuanceId: grant.issuanceId,
  };
}

function serializeTimetable(timetable: ClassGroupTimetable | TeacherTimetable) {
  return {
    ...timetable,
    events: timetable.events.map(event => ({
      ...event,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
    })),
  };
}

function serializeFinanceSummary(summary: Awaited<ReturnType<import("@edaya/service").SchoolService["getStudentFinanceSummary"]>>) {
  return {
    studentId: summary.studentId,
    academicYearId: summary.academicYearId,
    accountId: summary.accountId,
    currency: summary.currency,
    available: { amount: summary.available.amount, currency: summary.available.currency },
    outstanding: { amount: summary.outstanding.amount, currency: summary.outstanding.currency },
    overdue: { amount: summary.overdue.amount, currency: summary.overdue.currency },
  };
}

function serializeAccountStatement(statement: Awaited<ReturnType<import("@edaya/service").SchoolService["getAccountStatement"]>>) {
  return {
    accountId: statement.account.id,
    studentId: statement.account.studentId,
    academicYearId: statement.account.academicYearId,
    currency: statement.account.currency,
    projectedAvailable: statement.projectedAvailable,
    entrySum: statement.entrySum,
    entries: statement.entries.map(entry => ({
      id: entry.id,
      direction: entry.direction,
      amount: entry.amount.amount,
      sourceKind: entry.sourceKind,
      sourceId: entry.sourceId,
      effectiveAt: entry.effectiveAt.toISOString(),
      recordedAt: entry.recordedAt.toISOString(),
      resultingAvailableBalance: entry.resultingAvailableBalance.amount,
    })),
    payments: statement.payments.map(payment => ({
      id: payment.id,
      kind: payment.kind,
      amount: payment.amount.amount,
      status: payment.status,
      paymentDate: payment.paymentDate.toISOString(),
      method: payment.method,
      reference: payment.reference,
    })),
    allocations: statement.allocations.map(allocation => ({
      id: allocation.id,
      chargeId: allocation.chargeId,
      amount: allocation.amount.amount,
      kind: allocation.kind,
    })),
    charges: statement.charges.map(charge => ({
      id: charge.id,
      label: charge.label,
      remainingObligation: charge.remainingObligation.amount,
      status: charge.status,
    })),
  };
}
