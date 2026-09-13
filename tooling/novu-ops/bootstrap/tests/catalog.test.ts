import { NOVU_EMAIL_WORKFLOW_ID } from "@edaya/adaptor-novu";
import { expect, test } from "bun:test";
import { buildBootstrapWorkflows } from "../catalog/workflows";
import { loadBootstrapEmailTemplates } from "../lib/load-templates";

test("Novu has exactly one immediate email step and no source, relationship or channel decisions", async () => {
  const templates = await loadBootstrapEmailTemplates();
  const workflows = buildBootstrapWorkflows(templates);
  expect(workflows.map(workflow => workflow.workflowId)).toEqual([NOVU_EMAIL_WORKFLOW_ID]);
  expect(workflows[0]!.steps.map(step => step.type)).toEqual(["email"]);
  expect(workflows[0]!.steps[0]!.controlValues).toMatchObject({ subject: "{{payload.emailSubject}}", body: templates.edayaShell, layoutId: null, disableOutputSanitization: true });
});
