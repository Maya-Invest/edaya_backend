import type { BootstrapEmailTemplates } from "./load-templates";

/** Shared Novu template variables for Edaya notification payloads. */
export const EDAYA_PAYLOAD_TITLE = "{{payload.title}}";
export const EDAYA_PAYLOAD_BODY = "{{payload.body}}";
export const EDAYA_PAYLOAD_EMAIL_SUBJECT = "{{payload.emailSubject}}";
export const EDAYA_PAYLOAD_EMAIL_BODY = "{{payload.emailBody}}";

export const EDAYA_EMAIL_STEP_ID = "edaya-email-html";
export const EDAYA_AUTH_EMAIL_STEP_ID = "edaya-auth-email-html";
export const EDAYA_INVITE_EMAIL_STEP_ID = "edaya-invite-email-html";

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

export function edayaInAppStep(name = "In-app"): {
  stepId: string;
  name: string;
  type: "in_app";
  controlValues: {
    subject: string;
    body: string;
  };
} {
  return {
    stepId: "edaya-in-app",
    name,
    type: "in_app",
    controlValues: {
      subject: EDAYA_PAYLOAD_TITLE,
      body: EDAYA_PAYLOAD_BODY,
    },
  };
}

export function edayaPushStep(name = "Push"): {
  stepId: string;
  name: string;
  type: "push";
  controlValues: {
    subject: string;
    body: string;
  };
} {
  return {
    stepId: "edaya-push",
    name,
    type: "push",
    controlValues: {
      subject: EDAYA_PAYLOAD_TITLE,
      body: EDAYA_PAYLOAD_BODY,
    },
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

export function edayaInvitationEmailStep(templates: BootstrapEmailTemplates): {
  stepId: string;
  name: string;
  type: "email";
  controlValues: EdayaHtmlEmailControlValues;
} {
  return {
    stepId: EDAYA_INVITE_EMAIL_STEP_ID,
    name: "Invitation email",
    type: "email",
    controlValues: edayaHtmlEmailControlValues(templates),
  };
}

export function edayaAuthEmailStep(templates: BootstrapEmailTemplates): {
  stepId: string;
  name: string;
  type: "email";
  controlValues: EdayaHtmlEmailControlValues;
} {
  return {
    stepId: EDAYA_AUTH_EMAIL_STEP_ID,
    name: "Auth email",
    type: "email",
    controlValues: edayaHtmlEmailControlValues(templates),
  };
}
