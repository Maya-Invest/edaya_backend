import type { BootstrapEmailTemplates } from "./load-templates";

/** Shared Novu template variables for Edaya notification payloads. */
export const EDAYA_PAYLOAD_TITLE = "{{payload.title}}";
export const EDAYA_PAYLOAD_BODY = "{{payload.body}}";
export const EDAYA_PAYLOAD_EMAIL_SUBJECT = "{{payload.emailSubject}}";
/** Liquid `| raw` so pre-rendered HTML (invite links, verify URLs) is not entity-escaped. */
export const EDAYA_PAYLOAD_EMAIL_BODY = "{{ payload.emailBody | raw }}";

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
  _templates: BootstrapEmailTemplates,
  name = "Email",
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
      subject: EDAYA_PAYLOAD_EMAIL_SUBJECT,
      body: EDAYA_PAYLOAD_EMAIL_BODY,
      editorType: "html",
    },
  };
}

export function edayaInvitationEmailStep(_templates: BootstrapEmailTemplates): {
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
      subject: EDAYA_PAYLOAD_EMAIL_SUBJECT,
      body: EDAYA_PAYLOAD_EMAIL_BODY,
      editorType: "html",
    },
  };
}

export function edayaAuthEmailStep(_templates: BootstrapEmailTemplates): {
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
    stepId: "edaya-auth-email",
    name: "Auth email",
    type: "email",
    controlValues: {
      subject: EDAYA_PAYLOAD_EMAIL_SUBJECT,
      body: EDAYA_PAYLOAD_EMAIL_BODY,
      editorType: "html",
    },
  };
}
