import type { BootstrapEmailTemplates } from "../lib/load-templates";
import type { BootstrapWorkflowDefinition } from "../lib/types";
import { NOVU_EMAIL_WORKFLOW_ID } from "@edaya/adaptor-novu";
import { edayaEmailStep } from "../lib/templates";

/** One email step, with no recipient decisions, delays, inbox or push steps. */
export function buildBootstrapWorkflows(templates: BootstrapEmailTemplates): BootstrapWorkflowDefinition[] {
  return [{ workflowId: NOVU_EMAIL_WORKFLOW_ID, name: "Transactional email", description: "Send the current destination and content supplied by the school dispatcher.", tags: ["edaya", "email"], steps: [edayaEmailStep(templates)] }];
}
