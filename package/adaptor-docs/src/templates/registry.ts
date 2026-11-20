import type { RenderFormat, TemplateCatalogEntry } from "../types";
import type { TemplateAssets } from "./load-assets";
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import { ACCOUNT_STATEMENT_V1_ASSETS } from "./account-statement.v1/assets";
import { ANNUAL_REPORT_CARD_V1_ASSETS } from "./annual-report-card.v1/assets";
import { ANNUAL_TRANSCRIPT_V1_ASSETS } from "./annual-transcript.v1/assets";
import { ATTENDANCE_SHEET_V1_ASSETS } from "./attendance-sheet.v1/assets";
import { CLASS_ROSTER_V1_ASSETS } from "./class-roster.v1/assets";
import { CLASS_TIMETABLE_V1_ASSETS } from "./class-timetable.v1/assets";
import { compileTemplateHtml } from "./compile-html";
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

function resolveImportedStyles(styles: string): string {
  if (styles.includes("{")) {
    return styles;
  }
  try {
    return readFileSync(styles, "utf8");
  }
  catch {
    return styles;
  }
}

// Share the compiler so its meta-schema is compiled once, not once per template.
// Compilation stays at module initialization because Workers prohibit eval in handlers.
const ajv = new Ajv({ allErrors: true, strict: false });

function createTemplateDefinition(assets: TemplateAssets): TemplateDefinition {
  const resolved: TemplateAssets = { ...assets, styles: resolveImportedStyles(assets.styles) };
  const validate = ajv.compile(resolved.schema);

  return {
    key: resolved.manifest.key,
    formats: resolved.manifest.formats,
    locales: resolved.manifest.locales,
    version: resolved.manifest.version,
    assets: resolved,
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
      return compileTemplateHtml({ locale, payload, assets: resolved });
    },
  };
}

const TEMPLATES: readonly TemplateDefinition[] = [
  createTemplateDefinition(REPORT_CARD_V1_ASSETS),
  createTemplateDefinition(ANNUAL_REPORT_CARD_V1_ASSETS),
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
