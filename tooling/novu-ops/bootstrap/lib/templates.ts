import type { BootstrapEmailTemplates } from "./load-templates";

/** Shared Novu template variables for Edaya notification payloads. */
export const EDAYA_PAYLOAD_TITLE = "{{payload.title}}";
export const EDAYA_PAYLOAD_BODY = "{{payload.body}}";
export const EDAYA_PAYLOAD_EMAIL_SUBJECT = "{{payload.emailSubject}}";
/** Liquid `| raw` so pre-rendered HTML (invite links, verify URLs) is not entity-escaped. */
export const EDAYA_PAYLOAD_EMAIL_BODY = "{{ payload.emailBody | raw }}";

export const EDAYA_EMAIL_STEP_ID = "edaya-email-html";

export interface EdayaHtmlEmailControlValues {
  subject: string;
  body: string;
  editorType: "html";
  layoutId: null;
  disableOutputSanitization: true;
}

export function edayaHtmlEmailControlValues(
  templates: BootstrapEmailTemplates,
): EdayaHtmlEmailControlValues {
  return {
    subject: EDAYA_PAYLOAD_EMAIL_SUBJECT,
    body: templates.edayaShell,
    editorType: "html",
    layoutId: null,
    disableOutputSanitization: true,
  };
}

export function edayaEmailStep(
  templates: BootstrapEmailTemplates,
  name = "Email",
): {
  stepId: string;
  name: string;
  type: "email";
  controlValues: EdayaHtmlEmailControlValues;
} {
  return {
    stepId: EDAYA_EMAIL_STEP_ID,
    name,
    type: "email",
    controlValues: edayaHtmlEmailControlValues(templates),
  };
}
