import type { AppRouteHandler } from "@/http/types";
import { Buffer } from "node:buffer";
import { BusinessRuleViolationError, IMPORT_MAX_FILE_BYTES, IMPORT_TYPES } from "@edaya/core";
import { dispatchAutoBilling, dispatchSchoolImports } from "@edaya/service";
import { createRoute, z } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { createRouter } from "@/http/create-app";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { importClientBindings } from "@/lib/school-api/import-client-bindings";
import { clientRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { schoolApiPath } from "@/lib/school-api/routes/paths";
import { coreRouteErrorResponses, validatedJson } from "@/lib/school-api/routes/shared";
import { scheduleBackgroundApplicationTask } from "@/lib/school-api/schedule-background-task";

const mode = z.enum(["S", "M", "O"]);
const outcome = z.enum(["pending", "created", "updated", "unchanged", "skipped", "blocked", "dependency_blocked", "failed", "cancelled"]);
const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const values = z.record(cell);
const record = z.record(z.unknown());
const approval = z.object({ staffMemberId: z.string(), subjectId: z.string(), assuranceLevel: z.enum(["standard", "verified", "strong"]), authenticatedAt: z.string(), approvedAt: z.string(), revision: z.number(), previewDigest: z.string() });
const batch = z.object({ id: z.string(), schoolId: z.string(), academicYearId: z.string(), createdByStaffId: z.string(), createdBySubjectId: z.string(), defaultOnExisting: mode, enrollmentEffectiveDate: z.string().nullable(), revision: z.number(), state: z.enum(["draft", "validated", "running", "completed", "cancelled"]), previewDigest: z.string().nullable(), workId: z.string().nullable(), approval: approval.nullable(), createdAt: z.string(), updatedAt: z.string() }).openapi("SchoolImportBatch");
const file = z.object({ id: z.string(), fileId: z.string(), batchId: z.string(), schoolId: z.string(), type: z.enum(IMPORT_TYPES), templateVersion: z.number(), revision: z.number(), fileName: z.string(), storageKey: z.string(), sha256: z.string(), headers: z.array(z.string()), createdAt: z.string() }).openapi("SchoolImportFile");
const row = z.object({ targetDecision: z.enum(["create", "update"]).optional(), resolvedReferences: z.record(z.string()).optional(), referenceSelections: z.record(z.string()).optional(), id: z.string(), batchId: z.string(), schoolId: z.string(), type: z.enum(IMPORT_TYPES), source: z.object({ fileId: z.string(), revisionId: z.string(), row: z.number(), sheet: z.string().optional() }), raw: values, values, targetId: z.string(), sourceKey: z.string(), effectiveMode: mode, inputDigest: z.string(), operationId: z.string(), collection: z.object({ ownerId: z.string(), memberIds: z.array(z.string()), before: z.array(record) }).optional(), dependencies: z.array(z.string()), current: record.nullable(), proposed: record.nullable(), expectedDigest: z.string().nullable(), issues: z.array(z.object({ replacementColumns: z.array(z.string()).optional(), code: z.string(), column: z.string().optional(), candidates: z.array(z.string()).optional(), severity: z.enum(["error", "warning"]) })), outcome, result: record.nullable() }).openapi("SchoolImportRow");
const detail = z.object({ batch, files: z.array(file), rows: z.array(row), counts: z.record(z.number()) }).openapi("SchoolImportDetail");
const download = z.object({ fileName: z.string(), contentType: z.string(), base64: z.string() }).openapi("SchoolImportDownload");
const identity = z.object({ batchId: z.string().min(1).max(100) }).strict();
const definitions = {
  candidates: { request: identity.extend({ rowId: z.string(), field: z.string() }).openapi("SchoolImportCandidatesRequest"), response: z.object({ revision: z.number(), candidates: z.array(z.object({ id: z.string(), name: z.string().optional(), shortName: z.string().optional(), identifier: z.string().optional() })) }).openapi("SchoolImportCandidates") },
  resolve: { request: identity.extend({ rowId: z.string(), revision: z.number().int(), field: z.string(), targetId: z.string().optional(), decision: z.enum(["create", "update"]).optional() }).openapi("ResolveSchoolImportRequest"), response: detail },
  export: { request: z.object({ type: z.enum(IMPORT_TYPES), academicYearId: z.string(), after: z.string().optional(), limit: z.number().int().min(1).max(500).optional(), format: z.enum(["csv", "xlsx"]).default("xlsx") }).strict().openapi("ExportSchoolImportRequest"), response: download.extend({ nextCursor: z.string().nullable() }).openapi("SchoolImportExport") },
  create: { request: z.object({ academicYearId: z.string().min(1), defaultOnExisting: mode.default("M"), enrollmentEffectiveDate: z.string().nullable().optional() }).strict().openapi("CreateSchoolImportRequest"), response: batch },
  settings: { request: identity.extend({ defaultOnExisting: mode, enrollmentEffectiveDate: z.string().nullable().optional() }).openapi("UpdateSchoolImportSettingsRequest"), response: batch },
  submit: { request: identity.extend({ fileId: z.string().optional(), type: z.enum(IMPORT_TYPES), fileName: z.string().min(1).max(200), base64: z.string().min(1).max(Math.ceil(IMPORT_MAX_FILE_BYTES / 3) * 4) }).openapi("SubmitSchoolImportFileRequest"), response: file },
  validate: { request: identity.openapi("ValidateSchoolImportRequest"), response: detail },
  confirm: { request: identity.extend({ revision: z.number().int().positive(), previewDigest: z.string().regex(/^[a-f0-9]{64}$/) }).openapi("ConfirmSchoolImportRequest"), response: batch },
  retry: { request: identity.openapi("RetrySchoolImportRequest"), response: detail },
  cancel: { request: identity.openapi("CancelSchoolImportRequest"), response: batch },
  status: { request: identity.openapi("GetSchoolImportStatusRequest"), response: z.object({ batch, counts: z.record(z.number()), version: z.number().int(), updatedAt: z.string().nullable() }).openapi("SchoolImportStatus") },
  detail: { request: identity.openapi("GetSchoolImportRequest"), response: detail },
  history: { request: z.object({ limit: z.number().int().min(1).max(100).optional(), before: z.string().optional() }).strict().openapi("SchoolImportHistoryRequest"), response: z.object({ batches: z.array(batch) }).openapi("SchoolImportHistory") },
  report: { request: identity.extend({ fileId: z.string(), format: z.enum(["csv", "xlsx"]).default("xlsx") }).openapi("SchoolImportReportRequest"), response: download },
  template: { request: z.object({ type: z.enum(IMPORT_TYPES), format: z.enum(["csv", "xlsx"]).default("xlsx") }).strict().openapi("SchoolImportTemplateRequest"), response: download },
};
const router = createRouter();
for (const key of Object.keys(definitions) as (keyof typeof definitions)[]) {
  const definition: {
    request: z.AnyZodObject;
    response: z.ZodTypeAny;
  } = definitions[key];
  const binding = importClientBindings[key]!;
  const route = createRoute({ method: "post", path: schoolApiPath("imports", key), tags: ["School Imports"], ...clientRouteOperation({ namespace: "imports", clientKey: key, path: `imports/${key}`, requestSchemaName: binding.requestSchemaName!, responseSchemaName: binding.responseSchemaName! }), request: { body: jsonContent(definition.request, binding.requestSchemaName!) }, responses: { 200: jsonContent(definition.response, binding.responseSchemaName!), ...coreRouteErrorResponses } });
  const handler: AppRouteHandler<typeof route> = async (c) => {
    if (!c.var.actor)
      return unauthorizedResponse(c);
    try {
      const service = c.var.schoolApp.forActor(c.var.actor).imports;
      const input = validatedJson(c);
      c.header("Cache-Control", "private, no-store");
      c.header("Vary", "Authorization");
      const run = async () => {
        switch (key) {
          case "candidates": return service.candidates(definitions.candidates.request.parse(input));
          case "resolve": return service.resolve(definitions.resolve.request.parse(input));
          case "export": {
            const body = definitions.export.request.parse(input);
            const result = await service.export(body);
            return { fileName: `${body.type}-v2.${body.format}`, contentType: body.format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: Buffer.from(result.bytes).toString("base64"), nextCursor: result.nextCursor };
          }
          case "create": return service.create(definitions.create.request.parse(input));
          case "settings": return service.settings(definitions.settings.request.parse(input));
          case "submit": {
            const body = definitions.submit.request.parse(input);
            const bytes = Buffer.from(body.base64, "base64");
            // Canonical round-trip validation remains bounded for full-size files;
            // a repeated-quartet regex can exhaust the engine stack on long input.
            if (bytes.toString("base64") !== body.base64)
              throw new BusinessRuleViolationError("IMPORT_BASE64_INVALID", "IMPORT_BASE64_INVALID");
            return service.submit({ ...body, bytes: new Uint8Array(bytes) });
          }
          case "validate": return service.validate(definitions.validate.request.parse(input));
          case "confirm": {
            const result = await service.confirm(definitions.confirm.request.parse(input));
            scheduleBackgroundApplicationTask(c, async (application) => {
              await dispatchSchoolImports(application, { maxPages: 1000, maxDurationMs: c.env.RUNTIME === "worker" ? 20000 : 300000 });
              await dispatchAutoBilling(application);
            });
            return result;
          }
          case "retry": return service.retry(definitions.retry.request.parse(input));
          case "cancel": return service.cancel(definitions.cancel.request.parse(input));
          case "status": return service.status(definitions.status.request.parse(input).batchId);
          case "detail": return service.detail(definitions.detail.request.parse(input).batchId);
          case "history": return { batches: await service.history(definitions.history.request.parse(input)) };
          case "report": {
            const body = definitions.report.request.parse(input);
            return { fileName: `corrections-${body.fileId}.${body.format}`, contentType: body.format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: Buffer.from(await service.report(body)).toString("base64") };
          }
          case "template": {
            const body = definitions.template.request.parse(input);
            return { fileName: `${body.type}-v2.${body.format}`, contentType: body.format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: Buffer.from(await service.template(body.type, body.format)).toString("base64") };
          }
        }
      };
      return c.json(await run(), 200);
    }
    catch (error) {
      return routeErrorResponse(c, error);
    }
  };
  router.openapi(route, handler);
}
export default router;
