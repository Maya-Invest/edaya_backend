import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { ActorMetadata } from "@edaya/authorization";
import { AcademicPeriodType, BusinessRuleViolationError } from "@edaya/core";
import { randomUUID } from "node:crypto";
import { timeOnboardingPhase } from "./timing";

export interface EnsureAcademicStructureFromDraftInput {
  schoolId: string;
  academicYearLabel: string;
  academicYearStart: string;
  academicYearEnd: string;
  periodType: "trimester" | "semester";
  periods: Array<{
    label: string;
    start: string;
    end: string;
  }>;
}

export interface EnsureAcademicStructureFromDraftResult {
  yearId: string;
  periodId: string;
  createdYear: boolean;
  createdPeriodCount: number;
}

function parseDateOnly(value: string): Date {
  const date = new Date(`${value.trim()}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BusinessRuleViolationError(
      "INVALID_ACADEMIC_DATE",
      `Invalid date: ${value}`,
    );
  }
  return date;
}

function toPeriodType(periodType: "trimester" | "semester"): AcademicPeriodType {
  return periodType === "semester"
    ? AcademicPeriodType.Semester
    : AcademicPeriodType.Trimester;
}

function periodsFitExistingYear(
  periods: EnsureAcademicStructureFromDraftInput["periods"],
  yearStart: Date,
  yearEnd: Date,
): boolean {
  const yearStartIso = yearStart.toISOString().slice(0, 10);
  const yearEndIso = yearEnd.toISOString().slice(0, 10);
  return periods.every(period =>
    period.start >= yearStartIso
    && period.end <= yearEndIso
    && period.start <= period.end,
  );
}

export async function ensureAcademicStructureFromDraft(
  application: ApiSchoolApplication,
  actor: ActorMetadata,
  input: EnsureAcademicStructureFromDraftInput,
): Promise<EnsureAcademicStructureFromDraftResult> {
  const service = application.forActor(actor);

  const [years, periods] = await Promise.all([
    application.repositories.academicYears.list({ schoolId: input.schoolId }),
    application.repositories.academicPeriods.list({ schoolId: input.schoolId }),
  ]);

  if (periods.length > 0) {
    const academicYearId = periods[0]!.academicYearId;
    const yearPeriods = periods.filter(period => period.academicYearId === academicYearId);
    await Promise.all(
      yearPeriods
        .filter(period => !period.isPublished)
        .map(period => service.setupWorkflow.publishAcademicPeriod({
          academicPeriodId: period.id,
        })),
    );
    const active = yearPeriods.find(period => period.isPublished) ?? yearPeriods[0]!;
    return {
      yearId: academicYearId,
      periodId: active.id,
      createdYear: false,
      createdPeriodCount: 0,
    };
  }

  const existingYear = years[0];
  let yearId = existingYear?.id;
  let createdYear = false;

  if (existingYear) {
    if (!periodsFitExistingYear(input.periods, existingYear.startDate, existingYear.endDate)) {
      throw new BusinessRuleViolationError(
        "ACADEMIC_PERIOD_OUTSIDE_YEAR",
        "Configured periods fall outside the existing academic year",
      );
    }
  }
  else {
    yearId = randomUUID();
    await timeOnboardingPhase("provision", "createAcademicYear", async () => {
      await service.setupWorkflow.createAcademicYear({
        id: yearId!,
        schoolId: input.schoolId,
        name: input.academicYearLabel.trim(),
        startDate: parseDateOnly(input.academicYearStart),
        endDate: parseDateOnly(input.academicYearEnd),
      });
    });
    createdYear = true;
  }

  if (!yearId) {
    throw new BusinessRuleViolationError(
      "NO_ACADEMIC_YEAR",
      "Academic year could not be resolved during onboarding provision",
    );
  }

  if (input.periods.length === 0) {
    throw new BusinessRuleViolationError(
      "ACADEMIC_PERIOD_REQUIRED",
      "At least one academic period is required",
    );
  }

  const periodType = toPeriodType(input.periodType);
  const createdPeriodIds = await timeOnboardingPhase(
    "provision",
    "createAcademicPeriods",
    async () => {
      const ids = input.periods.map(() => randomUUID());
      await Promise.all(ids.map((periodId, index) => {
        const period = input.periods[index]!;
        return service.setupWorkflow.createAcademicPeriod({
          id: periodId,
          schoolId: input.schoolId,
          academicYearId: yearId!,
          name: period.label.trim(),
          type: periodType,
          startDate: parseDateOnly(period.start),
          endDate: parseDateOnly(period.end),
          isPublished: false,
        });
      }));
      return ids;
    },
    { count: input.periods.length },
  );

  await timeOnboardingPhase("provision", "publishAcademicPeriods", async () => {
    await Promise.all(createdPeriodIds.map(periodId =>
      service.setupWorkflow.publishAcademicPeriod({ academicPeriodId: periodId }),
    ));
  }, { count: createdPeriodIds.length });

  return {
    yearId,
    periodId: createdPeriodIds[0]!,
    createdYear,
    createdPeriodCount: createdPeriodIds.length,
  };
}
