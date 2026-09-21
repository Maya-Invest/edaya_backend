import type { GetAppShellCountsInput, GetClassGroupTimetableInput, GetSchoolOverviewInput, GetTeacherTimetableInput, ResolveTimetableSpaceInput } from "@edaya/service";
import type { CoreQueryConfig } from "@/lib/school-api/registry";
import { requireActor, wrapResolver } from "@/lib/graphql/resolver-utils";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function createCoreQueryResolver(queryConfig: CoreQueryConfig) {
  return wrapResolver(async (context, args: { input: unknown }) => {
    const actor = requireActor(context);
    const service = context.get("schoolApp").forActor(actor);
    const payload = asRecord(args.input);

    if (queryConfig.methodName === "getSchoolOverview") {
      const input: GetSchoolOverviewInput = {
        schoolId: payload.schoolId as string,
        academicYearId: payload.academicYearId as string,
        academicPeriodId: payload.academicPeriodId as string,
        referenceDate: payload.referenceDate
          ? new Date(`${payload.referenceDate as string}T00:00:00.000Z`)
          : undefined,
      };
      return service.getSchoolOverview(input);
    }

    if (queryConfig.methodName === "getAppShellCounts") {
      const input: GetAppShellCountsInput = {
        schoolId: payload.schoolId as string,
        ...(Array.isArray(payload.classGroupIds)
          ? { classGroupIds: payload.classGroupIds as string[] }
          : {}),
      };
      return service.getAppShellCounts(input);
    }

    if (queryConfig.methodName === "getClassGroupTimetable") {
      const input: GetClassGroupTimetableInput = {
        classGroupId: payload.classGroupId as string,
        startDate: new Date(`${payload.startDate as string}T00:00:00.000Z`),
        endDate: new Date(`${payload.endDate as string}T00:00:00.000Z`),
      };
      const timetable = await service.getClassGroupTimetable(input);
      return serializeTimetableEvents(timetable);
    }

    if (queryConfig.methodName === "getTeacherTimetable") {
      const input: GetTeacherTimetableInput = {
        teacherId: payload.teacherId as string,
        startDate: new Date(`${payload.startDate as string}T00:00:00.000Z`),
        endDate: new Date(`${payload.endDate as string}T00:00:00.000Z`),
      };
      const timetable = await service.getTeacherTimetable(input);
      return serializeTimetableEvents(timetable);
    }

    if (queryConfig.methodName === "resolveTimetableSpace") {
      const input: ResolveTimetableSpaceInput = {
        classGroupId: payload.classGroupId as string,
        academicYearId: payload.academicYearId as string,
        startDate: new Date(`${payload.startDate as string}T00:00:00.000Z`),
        endDate: new Date(`${payload.endDate as string}T00:00:00.000Z`),
      };
      const cells = await service.resolveTimetableSpace(input);
      return cells.map(cell => ({
        ...cell,
        startsAt: cell.startsAt.toISOString(),
        endsAt: cell.endsAt.toISOString(),
      }));
    }

    if (queryConfig.methodName === "getStudentFinanceSummary") {
      const summary = await service.getStudentFinanceSummary({
        studentId: payload.studentId as string,
        academicYearId: payload.academicYearId as string,
      });
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

    if (queryConfig.methodName === "getAccountStatement") {
      const statement = await service.getAccountStatement({ accountId: payload.accountId as string });
      return serializeGraphqlAccountStatement(statement);
    }

    if (queryConfig.methodName === "getSchoolFinanceAging") {
      return service.getSchoolFinanceAging({
        schoolId: payload.schoolId as string,
        academicYearId: payload.academicYearId as string | undefined,
      });
    }

    if (queryConfig.methodName === "getFinanceReconciliation") {
      return service.getFinanceReconciliation({
        schoolId: payload.schoolId as string,
        academicYearId: payload.academicYearId as string | undefined,
      });
    }

    if (queryConfig.methodName === "previewAccountAllocation") {
      const allocation = payload.allocation as { mode: "account_only" | "fifo" | "targeted"; targets?: { chargeId: string; amount: number }[] };
      return service.previewAccountAllocation({
        accountId: payload.accountId as string,
        allocation: allocation.mode === "targeted"
          ? { mode: "targeted", targets: allocation.targets ?? [] }
          : { mode: allocation.mode },
      });
    }

    if (queryConfig.methodName === "getRelatedFamilyFinanceOverview") {
      const overview = await service.getRelatedFamilyFinanceOverview({
        academicYearId: payload.academicYearId as string,
      });
      return {
        academicYearId: overview.academicYearId,
        students: overview.students.map(summary => ({
          studentId: summary.studentId,
          academicYearId: summary.academicYearId,
          accountId: summary.accountId,
          currency: summary.currency,
          available: { amount: summary.available.amount, currency: summary.available.currency },
          outstanding: { amount: summary.outstanding.amount, currency: summary.outstanding.currency },
          overdue: { amount: summary.overdue.amount, currency: summary.overdue.currency },
        })),
      };
    }

    if (queryConfig.methodName === "getStudentAccountStatement") {
      const statement = await service.getStudentAccountStatement({
        studentId: payload.studentId as string,
        academicYearId: payload.academicYearId as string,
        currency: payload.currency as string | undefined,
      });
      if (!statement)
        return null;
      return serializeGraphqlAccountStatement(statement);
    }

    if (queryConfig.methodName === "listOpenDueCharges") {
      return service.listOpenDueCharges({
        schoolId: payload.schoolId as string,
        academicYearId: payload.academicYearId as string | undefined,
      });
    }

    if (queryConfig.methodName === "getPaymentSettlementHistory") {
      return service.getPaymentSettlementHistory({
        accountId: payload.accountId as string,
      });
    }

    if (queryConfig.methodName === "reconcileStudentYearAccount") {
      return service.reconcileStudentYearAccount({
        accountId: payload.accountId as string,
      });
    }

    if (queryConfig.methodName === "reconcileSchoolFinance") {
      return service.reconcileSchoolFinance({
        schoolId: payload.schoolId as string,
        academicYearId: payload.academicYearId as string | undefined,
      });
    }

    if (queryConfig.methodName === "listDocumentTemplates") {
      return service.listDocumentTemplates();
    }

    if (queryConfig.methodName === "listDocumentIssuances") {
      return service.listDocumentIssuances({
        studentId: payload.studentId as string | undefined,
        academicYearId: payload.academicYearId as string | undefined,
        classGroupId: payload.classGroupId as string | undefined,
        templateKey: payload.templateKey as never,
        sourceId: payload.sourceId as string | undefined,
        status: payload.status as never,
      });
    }

    if (queryConfig.methodName === "getDocumentIssuance") {
      return service.getDocumentIssuance({ id: payload.id as string });
    }

    if (queryConfig.methodName === "grantDocumentDownload") {
      const grant = await service.grantDocumentDownload({ id: payload.id as string });
      return serializeGraphqlDocumentDownload(grant);
    }

    if (queryConfig.methodName === "grantDocumentBundleDownload") {
      const bundle = await service.grantDocumentBundleDownload({
        issuanceIds: payload.issuanceIds as string[],
      });
      return { items: bundle.items.map(serializeGraphqlDocumentDownload) };
    }

    if (queryConfig.methodName === "listFamilyFeedbackCampaigns") {
      return service.listFamilyFeedbackCampaigns();
    }

    if (queryConfig.methodName === "getFamilyFeedbackCampaign") {
      return service.getFamilyFeedbackCampaign({ id: payload.id as string });
    }

    if (queryConfig.methodName === "previewFamilyFeedbackAudience") {
      return service.previewFamilyFeedbackAudience({
        id: payload.id as string | undefined,
        academicYearId: payload.academicYearId as string,
        academicPeriodId: payload.academicPeriodId as string,
        teacherAssignmentId: payload.teacherAssignmentId as string,
      });
    }

    if (queryConfig.methodName === "getFamilyFeedbackInstrument") {
      return service.getFamilyFeedbackInstrument({ locale: payload.locale as "fr" | "en" });
    }

    if (queryConfig.methodName === "listGuardianFamilyFeedbackCampaigns") {
      return service.listGuardianFamilyFeedbackCampaigns();
    }

    if (queryConfig.methodName === "getGuardianFamilyFeedbackQuestionnaire") {
      return service.getGuardianFamilyFeedbackQuestionnaire({
        campaignId: payload.campaignId as string,
        studentId: payload.studentId as string,
        locale: payload.locale as "fr" | "en",
      });
    }

    if (queryConfig.methodName === "listFamilyFeedbackComments") {
      return service.listFamilyFeedbackComments({ id: payload.id as string });
    }

    if (queryConfig.methodName === "getFamilyFeedbackAggregateReview") {
      return service.getFamilyFeedbackAggregateReview({ id: payload.id as string });
    }

    if (queryConfig.methodName === "listTeacherFamilyFeedbackResults") {
      return service.listTeacherFamilyFeedbackResults();
    }

    if (queryConfig.methodName === "getTeacherFamilyFeedbackResult") {
      return service.getTeacherFamilyFeedbackResult({ id: payload.id as string });
    }

    const count = await service[queryConfig.methodName](payload.schoolId as string);
    return { count };
  });
}

function serializeTimetableEvents(timetable: { events: Array<{ startsAt: Date; endsAt: Date }> }) {
  return {
    ...timetable,
    events: timetable.events.map(event => ({
      ...event,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
    })),
  };
}

function serializeGraphqlDocumentDownload(grant: Awaited<ReturnType<import("@edaya/service").SchoolService["grantDocumentDownload"]>>) {
  return {
    downloadUrl: grant.downloadUrl,
    expiresAt: grant.expiresAt instanceof Date ? grant.expiresAt.toISOString() : grant.expiresAt,
    fileName: grant.fileName,
    issuanceId: grant.issuanceId,
  };
}

function serializeGraphqlAccountStatement(statement: Awaited<ReturnType<import("@edaya/service").SchoolService["getAccountStatement"]>>) {
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
