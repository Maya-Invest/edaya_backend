import type { ClientNamespaceBindings } from "@maya-invest/edaya-api-client/contract";

const requests = { candidates: "SchoolImportCandidatesRequest", resolve: "ResolveSchoolImportRequest", export: "ExportSchoolImportRequest", create: "CreateSchoolImportRequest", settings: "UpdateSchoolImportSettingsRequest", submit: "SubmitSchoolImportFileRequest", validate: "ValidateSchoolImportRequest", confirm: "ConfirmSchoolImportRequest", retry: "RetrySchoolImportRequest", cancel: "CancelSchoolImportRequest", status: "GetSchoolImportStatusRequest", detail: "GetSchoolImportRequest", history: "SchoolImportHistoryRequest", report: "SchoolImportReportRequest", template: "SchoolImportTemplateRequest" } as const;
const responses = { candidates: "SchoolImportCandidates", resolve: "SchoolImportDetail", export: "SchoolImportExport", create: "SchoolImportBatch", settings: "SchoolImportBatch", submit: "SchoolImportFile", validate: "SchoolImportDetail", confirm: "SchoolImportBatch", retry: "SchoolImportDetail", cancel: "SchoolImportBatch", status: "SchoolImportStatus", detail: "SchoolImportDetail", history: "SchoolImportHistory", report: "SchoolImportDownload", template: "SchoolImportDownload" } as const;
export const importClientBindings = Object.fromEntries(Object.keys(requests).map((key) => {
  const name = key as keyof typeof requests;
  return [name, { method: "POST", path: `imports/${name}`, requestSchemaName: requests[name], responseSchemaName: responses[name] }];
})) as ClientNamespaceBindings;
