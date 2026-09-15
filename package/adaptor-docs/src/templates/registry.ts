import Ajv from "ajv";
import type { RenderFormat, TemplateCatalogEntry } from "../types";
import { compileTemplateHtml } from "./compile-html";
import type { TemplateAssets } from "./load-assets";
import { ACCOUNT_STATEMENT_V1_ASSETS } from "./account-statement.v1/assets";
import { ANNUAL_TRANSCRIPT_V1_ASSETS } from "./annual-transcript.v1/assets";
import { ATTENDANCE_SHEET_V1_ASSETS } from "./attendance-sheet.v1/assets";
import { CLASS_ROSTER_V1_ASSETS } from "./class-roster.v1/assets";
import { CLASS_TIMETABLE_V1_ASSETS } from "./class-timetable.v1/assets";
import { CONVOCATION_V1_ASSETS } from "./convocation.v1/assets";
import { ENROLLMENT_RECORD_V1_ASSETS } from "./enrollment-record.v1/assets";
import { INCIDENT_REPORT_V1_ASSETS } from "./incident-report.v1/assets";
import { INVOICE_V1_ASSETS } from "./invoice.v1/assets";
import { LOGBOOK_V1_ASSETS } from "./logbook.v1/assets";
import { PAYMENT_REMINDER_V1_ASSETS } from "./payment-reminder.v1/assets";
import { RECEIPT_V1_ASSETS } from "./receipt.v1/assets";
import { REPORT_CARD_V1_ASSETS } from "./report-card.v1/assets";
import { SCHOOLING_CERTIFICATE_V1_ASSETS } from "./schooling-certificate.v1/assets";
import { SETTLEMENT_QUITTANCE_V1_ASSETS } from "./settlement-quittance.v1/assets";
import { STUDENT_ID_CARD_V1_ASSETS } from "./student-id-card.v1/assets";
import { TEACHER_TIMETABLE_V1_ASSETS } from "./teacher-timetable.v1/assets";
import { WITHDRAWAL_CERTIFICATE_V1_ASSETS } from "./withdrawal-certificate.v1/assets";

export interface TemplateDefinition {
  readonly key: string;
  readonly formats: readonly RenderFormat[];
  readonly locales: readonly string[];
  readonly version: string;
  readonly assets: TemplateAssets;
  validatePayload: (payload: unknown) => string | null;
  compileHtml: (locale: string, payload: unknown) => string;
}

function createTemplateDefinition(assets: TemplateAssets): TemplateDefinition {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(assets.schema);

  return {
    key: assets.manifest.key,
    formats: assets.manifest.formats,
    locales: assets.manifest.locales,
    version: assets.manifest.version,
    assets,
    validatePayload(payload: unknown): string | null {
      if (validate(payload)) {
        return null;
      }
      const first = validate.errors?.[0];
      if (!first) {
        return "payload is invalid";
      }
      const path = first.instancePath.length > 0 ? first.instancePath.replaceAll("/", ".").slice(1) : "payload";
      if (first.keyword === "required") {
        const params = first.params as { missingProperty?: unknown };
        const missing = params.missingProperty;
        if (typeof missing === "string") {
          return path === "payload"
            ? `payload.${missing} is required`
            : `${path}.${missing} is required`;
        }
      }
      return `${path} ${first.message ?? "is invalid"}`;
    },
    compileHtml(locale: string, payload: unknown): string {
      return compileTemplateHtml({ locale, payload, assets });
    },
  };
}

const TEMPLATES: readonly TemplateDefinition[] = [
  createTemplateDefinition(REPORT_CARD_V1_ASSETS),
  createTemplateDefinition(LOGBOOK_V1_ASSETS),
  createTemplateDefinition(SCHOOLING_CERTIFICATE_V1_ASSETS),
  createTemplateDefinition(ENROLLMENT_RECORD_V1_ASSETS),
  createTemplateDefinition(STUDENT_ID_CARD_V1_ASSETS),
  createTemplateDefinition(INVOICE_V1_ASSETS),
  createTemplateDefinition(RECEIPT_V1_ASSETS),
  createTemplateDefinition(SETTLEMENT_QUITTANCE_V1_ASSETS),
  createTemplateDefinition(ACCOUNT_STATEMENT_V1_ASSETS),
  createTemplateDefinition(PAYMENT_REMINDER_V1_ASSETS),
  createTemplateDefinition(WITHDRAWAL_CERTIFICATE_V1_ASSETS),
  createTemplateDefinition(ANNUAL_TRANSCRIPT_V1_ASSETS),
  createTemplateDefinition(CONVOCATION_V1_ASSETS),
  createTemplateDefinition(CLASS_TIMETABLE_V1_ASSETS),
  createTemplateDefinition(TEACHER_TIMETABLE_V1_ASSETS),
  createTemplateDefinition(CLASS_ROSTER_V1_ASSETS),
  createTemplateDefinition(ATTENDANCE_SHEET_V1_ASSETS),
  createTemplateDefinition(INCIDENT_REPORT_V1_ASSETS),
];

export function listTemplateDefinitions(): readonly TemplateDefinition[] {
  return TEMPLATES;
}

export function getTemplateDefinition(key: string): TemplateDefinition | null {
  return TEMPLATES.find(template => template.key === key) ?? null;
}

export function toCatalogEntry(template: TemplateDefinition): TemplateCatalogEntry {
  return {
    key: template.key,
    formats: template.formats,
    locales: template.locales,
    version: template.version,
  };
}
