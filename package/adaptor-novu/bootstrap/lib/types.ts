import type {
  EmailStepUpsertDto,
  InAppStepUpsertDto,
  PushStepUpsertDto,
  UpdateWorkflowDto,
} from "@novu/api/models/components";

export type BootstrapWorkflowStep = InAppStepUpsertDto | EmailStepUpsertDto | PushStepUpsertDto;

export interface BootstrapWorkflowDefinition {
  workflowId: string;
  name: string;
  description: string;
  tags: string[];
  steps: BootstrapWorkflowStep[];
}

export type BootstrapWorkflowSpec = Omit<UpdateWorkflowDto, "workflowId"> & {
  workflowId: string;
};

export type ApplyAction = "create" | "update" | "noop";

export interface ApplyWorkflowPlan {
  workflowId: string;
  action: ApplyAction;
  reason?: string;
}
