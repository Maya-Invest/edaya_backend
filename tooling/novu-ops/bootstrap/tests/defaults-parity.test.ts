import { describe, expect, test } from "bun:test";
import { NOTIFICATION_TEMPLATE_KEYS } from "@edaya/service";
import { buildBootstrapWorkflows } from "../catalog/workflows";
import { loadBootstrapEmailTemplates } from "../lib/load-templates";
import {
  EDAYA_PAYLOAD_BODY,
  EDAYA_PAYLOAD_EMAIL_BODY,
  EDAYA_PAYLOAD_EMAIL_SUBJECT,
  EDAYA_PAYLOAD_TITLE,
} from "../lib/templates";

describe("notification template catalog parity with domain-core", () => {
  test("bootstrap workflow ids match NOTIFICATION_TEMPLATE_KEYS", async () => {
    const templates = await loadBootstrapEmailTemplates();
    const workflowIds = buildBootstrapWorkflows(templates).map(workflow => workflow.workflowId);
    const schoolWorkflowIds = workflowIds.filter(workflowId => !workflowId.startsWith("auth."));

    expect(schoolWorkflowIds.sort()).toEqual([...NOTIFICATION_TEMPLATE_KEYS].sort());
  });

  test("novu steps passthrough rendered payload fields from core", async () => {
    const templates = await loadBootstrapEmailTemplates();
    const workflows = buildBootstrapWorkflows(templates);

    for (const workflow of workflows) {
      for (const step of workflow.steps) {
        if (step.type === "email") {
          expect(step.controlValues).toBeDefined();
          expect(step.controlValues!.subject).toBe(EDAYA_PAYLOAD_EMAIL_SUBJECT);
          expect(step.controlValues!.body).toBe(EDAYA_PAYLOAD_EMAIL_BODY);
        }
        if (step.type === "in_app") {
          expect(step.controlValues).toBeDefined();
          expect(step.controlValues!.subject).toBe(EDAYA_PAYLOAD_TITLE);
          expect(step.controlValues!.body).toBe(EDAYA_PAYLOAD_BODY);
        }
      }
    }
  });
});
