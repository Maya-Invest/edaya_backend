import { reportModuleBaseSchema, reportSettingsSchema, subjectSchema } from "@edaya/core";
import { z } from "@hono/zod-openapi";
import { reportModuleResponseSchema } from "./entities";
import { objectFromSchema } from "./helpers";

export const reportConfigurationQuerySchema = z.object({ gradeLevelId: z.string().min(1), academicYearId: z.string().min(1) }).openapi("ReportConfigurationQuery");
const scope = reportConfigurationQuerySchema.extend({ requestId: z.string().min(1).max(200), expectedRevision: z.number().int().nonnegative() });

export const configureReportModulesCommandSchema = scope.extend({
  action: z.enum(["save", "delete", "assign"]),
  module: objectFromSchema(reportModuleBaseSchema).pick({ id: true, name: true, shortName: true, order: true, weightingMode: true, explicitWeight: true }).optional(),
  moduleId: z.string().min(1).nullable().optional(),
  assignments: z.array(z.object({ subjectId: z.string().min(1), moduleId: z.string().min(1).nullable(), order: z.number().int().nonnegative().optional() })).max(500).optional(),
}).openapi("ConfigureReportModulesCommand");

export const configureReportSettingsCommandSchema = scope.extend({ passThreshold: z.number().finite().nonnegative().nullable().optional() }).openapi("ConfigureReportSettingsCommand");

export const reportConfigurationResponseSchema = reportConfigurationQuerySchema.extend({
  settings: objectFromSchema(reportSettingsSchema),
  modules: z.array(reportModuleResponseSchema),
  subjects: z.array(objectFromSchema(subjectSchema).extend({ categoryName: z.string().optional() })),
}).openapi("ReportConfigurationResponse");
