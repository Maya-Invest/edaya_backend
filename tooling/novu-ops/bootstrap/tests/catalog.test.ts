import { describe, expect, test } from "bun:test";
import { NOVU_NOTIFICATION_WORKFLOW_IDS } from "@edaya/adaptor-novu";
import { buildBootstrapWorkflows } from "../catalog/workflows";
import { loadBootstrapEmailTemplates } from "../lib/load-templates";
import { normalizeWorkflowFingerprint } from "../lib/fingerprint";

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

  test("loads email templates from html files", async () => {
    const templates = await loadBootstrapEmailTemplates();
    expect(templates.standardNotification).toContain("{{ payload.emailBody | raw }}");
    expect(templates.accountInvitation).toContain("{{ payload.emailBody | raw }}");
    expect(templates.accountInvitationSubject).toContain("{{payload.emailSubject}}");
  });

  test("fingerprints are stable for unchanged definitions", async () => {
    const templates = await loadBootstrapEmailTemplates();
    const [first] = buildBootstrapWorkflows(templates);
    expect(normalizeWorkflowFingerprint(first!)).toBe(normalizeWorkflowFingerprint(first!));
  });
});
