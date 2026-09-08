import { describe, expect, test } from "bun:test";
import { NOVU_NOTIFICATION_WORKFLOW_IDS } from "@edaya/adaptor-novu";
import { buildBootstrapWorkflows } from "../catalog/workflows";
import { loadBootstrapEmailTemplates } from "../lib/load-templates";
import { normalizeWorkflowFingerprint } from "../lib/fingerprint";
import {
  EDAYA_AUTH_EMAIL_STEP_ID,
  EDAYA_EMAIL_STEP_ID,
  EDAYA_INVITE_EMAIL_STEP_ID,
  EDAYA_PAYLOAD_EMAIL_BODY,
} from "../lib/templates";

describe("Novu bootstrap catalog", () => {
  test("includes every operational workflow id used for subscriber preferences", async () => {
    const templates = await loadBootstrapEmailTemplates();
    const workflows = buildBootstrapWorkflows(templates);
    const workflowIds = workflows.map(workflow => workflow.workflowId);

    for (const workflowId of NOVU_NOTIFICATION_WORKFLOW_IDS) {
      expect(workflowIds).toContain(workflowId);
    }
  });

  test("uses unique workflow trigger ids", async () => {
    const templates = await loadBootstrapEmailTemplates();
    const workflowIds = buildBootstrapWorkflows(templates).map(workflow => workflow.workflowId);
    expect(new Set(workflowIds).size).toBe(workflowIds.length);
  });

  test("includes account invitation workflow", async () => {
    const templates = await loadBootstrapEmailTemplates();
    const workflowIds = buildBootstrapWorkflows(templates).map(workflow => workflow.workflowId);
    expect(workflowIds).toContain("account_invitation");
  });

  test("includes auth email workflows", async () => {
    const templates = await loadBootstrapEmailTemplates();
    const workflowIds = buildBootstrapWorkflows(templates).map(workflow => workflow.workflowId);
    expect(workflowIds).toContain("auth.otp");
    expect(workflowIds).toContain("auth.email_verification");
  });

  test("loads the shared HTML email shell", async () => {
    const templates = await loadBootstrapEmailTemplates();
    expect(templates.edayaShell).toContain("<html");
    expect(templates.edayaShell).toContain("<table");
    expect(templates.edayaShell).toContain(EDAYA_PAYLOAD_EMAIL_BODY);
    expect(templates.edayaShell).not.toContain("1234 Example Street");
  });

  test("uses bumped html email step ids", async () => {
    const templates = await loadBootstrapEmailTemplates();
    const workflows = buildBootstrapWorkflows(templates);
    const emailStepIds = workflows.flatMap(workflow =>
      workflow.steps.filter(step => step.type === "email").map(step => step.stepId),
    );

    expect(emailStepIds).toContain(EDAYA_EMAIL_STEP_ID);
    expect(emailStepIds).toContain(EDAYA_AUTH_EMAIL_STEP_ID);
    expect(emailStepIds).toContain(EDAYA_INVITE_EMAIL_STEP_ID);
    expect(emailStepIds).not.toContain("edaya-email");
    expect(emailStepIds).not.toContain("edaya-auth-email");
    expect(emailStepIds).not.toContain("edaya-invite-email");
  });

  test("fingerprints are stable for unchanged definitions", async () => {
    const templates = await loadBootstrapEmailTemplates();
    const [first] = buildBootstrapWorkflows(templates);
    expect(normalizeWorkflowFingerprint(first!)).toBe(normalizeWorkflowFingerprint(first!));
  });
});
