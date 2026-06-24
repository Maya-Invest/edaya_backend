import type { BootstrapEmailTemplates } from "./load-templates";

/** Shared Novu template variables for Edaya notification payloads. */
export const EDAYA_PAYLOAD_TITLE = "{{payload.title}}";
export const EDAYA_PAYLOAD_BODY = "{{payload.body}}";

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

export function edayaEmailStep(
  templates: BootstrapEmailTemplates,
  name = "Email",
  subject = EDAYA_PAYLOAD_TITLE,
): {
  stepId: string;
  name: string;
  type: "email";
  controlValues: {
    subject: string;
    body: string;
    editorType: "html";
  };
} {
  return {
    stepId: "edaya-email",
    name,
    type: "email",
    controlValues: {
      subject,
      body: templates.standardNotification,
      editorType: "html",
    },
  };
}

export function edayaInvitationEmailStep(templates: BootstrapEmailTemplates): {
  stepId: string;
  name: string;
  type: "email";
  controlValues: {
    subject: string;
    body: string;
    editorType: "html";
  };
} {
  return {
    stepId: "edaya-invite-email",
    name: "Invitation email",
    type: "email",
    controlValues: {
      subject: templates.accountInvitationSubject,
      body: templates.accountInvitation,
      editorType: "html",
    },
  };
}
