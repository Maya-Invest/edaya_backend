import { describe, expect, test } from "bun:test";
import type { WorkflowResponseDto } from "@novu/api/models/components";
import { mergeStepsForUpdate } from "../lib/apply-workflows";
import type { BootstrapWorkflowStep } from "../lib/types";
import {
  EDAYA_AUTH_EMAIL_STEP_ID,
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
      stepId: EDAYA_AUTH_EMAIL_STEP_ID,
      name: "Auth email",
      type: "email",
      controlValues: htmlControls,
    }];

    const merged = mergeStepsForUpdate(desired, [
      existingEmailStep("edaya-auth-email", "old-block-step-id"),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      stepId: EDAYA_AUTH_EMAIL_STEP_ID,
      name: "Auth email",
      type: "email",
    });
    expect(merged[0]).not.toHaveProperty("id");
  });

  test("reuses the existing step id when stepId matches", () => {
    const desired: BootstrapWorkflowStep[] = [{
      stepId: EDAYA_AUTH_EMAIL_STEP_ID,
      name: "Auth email",
      type: "email",
      controlValues: htmlControls,
    }];

    const merged = mergeStepsForUpdate(desired, [
      existingEmailStep(EDAYA_AUTH_EMAIL_STEP_ID, "existing-html-step-id"),
    ]);

    expect(merged[0]).toMatchObject({
      id: "existing-html-step-id",
      stepId: EDAYA_AUTH_EMAIL_STEP_ID,
    });
  });
});
