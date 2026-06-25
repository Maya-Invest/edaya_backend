import type {
  CreateWorkflowDto,
  EmailStepUpsertDto,
  InAppStepUpsertDto,
} from "@novu/api/models/components";

export type BootstrapWorkflowStep = InAppStepUpsertDto | EmailStepUpsertDto;

export interface BootstrapWorkflowDefinition {
  workflowId: string;
  name: string;
  description: string;
  tags: string[];
  steps: BootstrapWorkflowStep[];
}

export type BootstrapWorkflowSpec = Omit<CreateWorkflowDto, "workflowId"> & {
  workflowId: string;
};

export type ApplyAction = "create" | "update" | "noop";

export interface ApplyWorkflowPlan {
  workflowId: string;
  action: ApplyAction;
  reason?: string;
}
