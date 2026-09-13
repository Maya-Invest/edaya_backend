import type { Novu } from "@novu/api";
import type { WorkflowResponseDto } from "@novu/api/models/components";
import type { BootstrapWorkflowStep } from "../lib/types";
import { describe, expect, test } from "bun:test";
import { buildBootstrapWorkflows } from "../catalog/workflows";
import { applyBootstrapWorkflows, mergeStepsForUpdate } from "../lib/apply-workflows";
import {
  EDAYA_EMAIL_STEP_ID,
  EDAYA_PAYLOAD_EMAIL_SUBJECT,
  edayaHtmlEmailControlValues,
} from "../lib/templates";

const htmlControls = edayaHtmlEmailControlValues({
  edayaShell: "<html><body>{{payload.emailBody}}</body></html>",
});

function existingEmailStep(stepId: string, id: string): WorkflowResponseDto["steps"][number] {
  return {
    id,
    stepId,
    name: "Auth email",
    type: "email",
    controlValues: {
      subject: EDAYA_PAYLOAD_EMAIL_SUBJECT,
      body: "{{payload.emailBody}}",
      editorType: "block",
    },
  } as WorkflowResponseDto["steps"][number];
}

describe("mergeStepsForUpdate", () => {
  test("does not reuse another step id when stepId differs", () => {
    const desired: BootstrapWorkflowStep[] = [{
      stepId: EDAYA_EMAIL_STEP_ID,
      name: "Auth email",
      type: "email",
      controlValues: htmlControls,
    }];

    const merged = mergeStepsForUpdate(desired, [
      existingEmailStep("edaya-auth-email", "old-block-step-id"),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      stepId: EDAYA_EMAIL_STEP_ID,
      name: "Auth email",
      type: "email",
    });
    expect(merged[0]).not.toHaveProperty("id");
  });

  test("reuses the existing step id when stepId matches", () => {
    const desired: BootstrapWorkflowStep[] = [{
      stepId: EDAYA_EMAIL_STEP_ID,
      name: "Auth email",
      type: "email",
      controlValues: htmlControls,
    }];

    const merged = mergeStepsForUpdate(desired, [
      existingEmailStep(EDAYA_EMAIL_STEP_ID, "existing-html-step-id"),
    ]);

    expect(merged[0]).toMatchObject({
      id: "existing-html-step-id",
      stepId: EDAYA_EMAIL_STEP_ID,
    });
  });
});

test("bootstrap replaces remote channel preferences instead of preserving a second routing decision", async () => {
  const definitions = buildBootstrapWorkflows({ edayaShell: "<html>{{payload.emailBody}}</html>" });
  const definition = definitions[0]!;
  const updates: Record<string, unknown>[] = [];
  const client = { workflows: {
    list: async () => ({ result: { workflows: [{ workflowId: definition.workflowId }] } }),
    get: async () => ({ result: {
      ...definition,
      active: false,
      preferences: { user: null, default: { all: { enabled: true, readOnly: false }, channels: { email: { enabled: false }, push: { enabled: true } } } },
    } }),
    update: async (input: Record<string, unknown>) => { updates.push(input); },
  } } as unknown as Novu;
  const result = await applyBootstrapWorkflows(client, definitions);
  expect(result.updated).toEqual([definition.workflowId]);
  expect(updates[0]).toMatchObject({ active: true, preferences: { user: null, workflow: { all: { enabled: true, readOnly: true }, channels: { email: { enabled: true }, push: { enabled: false }, in_app: { enabled: false } } } } });
});
