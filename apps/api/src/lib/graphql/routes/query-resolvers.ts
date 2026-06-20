import type { GetSchoolOverviewInput } from "@edaya/core";
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

    const count = await service[queryConfig.methodName](payload.schoolId as string);
    return { count };
  });
}
