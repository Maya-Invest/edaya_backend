import type { Novu } from "@novu/api";
import type {
  PreferencesRequestDto,
  UpdateWorkflowDto,
  WorkflowResponseDto,
} from "@novu/api/models/components";
import type { BootstrapWorkflowDefinition, BootstrapWorkflowStep } from "./types";
import { ResourceOriginEnum } from "@novu/api/models/components";
import {
  normalizeRemoteWorkflowFingerprint,
  normalizeWorkflowFingerprint,
} from "./fingerprint";

export interface ApplyWorkflowsResult {
  created: string[];
  updated: string[];
  unchanged: string[];
}

function defaultWorkflowPreferences(): PreferencesRequestDto {
  return {
    user: null,
    workflow: {
      all: { enabled: true, readOnly: true },
      channels: {
        in_app: { enabled: false },
        email: { enabled: true },
        sms: { enabled: false },
        push: { enabled: false },
        chat: { enabled: false },
      },
    },
  };
}

async function listAllWorkflowSummaries(novu: Novu) {
  const workflows = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const response = await novu.workflows.list({ limit, offset });
    const page = response.result.workflows;
    workflows.push(...page);
    if (page.length < limit) {
      break;
    }
    offset += limit;
  }

  return workflows;
}

export function mergeStepsForUpdate(
  desired: BootstrapWorkflowStep[],
  existing: WorkflowResponseDto["steps"],
): UpdateWorkflowDto["steps"] {
  return desired.map((step) => {
    const match = existing.find(candidate => candidate.stepId === step.stepId);

    return {
      ...step,
      ...(match?.id ? { id: match.id } : {}),
      ...(step.stepId ? { stepId: step.stepId } : {}),
    };
  });
}

export async function applyBootstrapWorkflows(
  novu: Novu,
  definitions: readonly BootstrapWorkflowDefinition[],
  options: { dryRun?: boolean } = {},
): Promise<ApplyWorkflowsResult> {
  const result: ApplyWorkflowsResult = {
    created: [],
    updated: [],
    unchanged: [],
  };

  const existingSummaries = await listAllWorkflowSummaries(novu);
  const existingByTriggerId = new Map(
    existingSummaries.map(summary => [summary.workflowId, summary]),
  );

  for (const definition of definitions) {
    const desiredFingerprint = normalizeWorkflowFingerprint(definition);
    const summary = existingByTriggerId.get(definition.workflowId);

    if (!summary) {
      if (!options.dryRun) {
        await novu.workflows.create({
          workflowId: definition.workflowId,
          name: definition.name,
          description: definition.description,
          tags: definition.tags,
          active: true,
          steps: definition.steps,
          preferences: defaultWorkflowPreferences(),
        });
      }
      result.created.push(definition.workflowId);
      continue;
    }

    const remote = await novu.workflows.get(summary.workflowId);
    const existing = remote.result;
    const remoteFingerprint = normalizeRemoteWorkflowFingerprint({
      workflowId: existing.workflowId,
      name: existing.name,
      description: existing.description,
      tags: existing.tags,
      steps: existing.steps.map(step => ({
        stepId: step.stepId,
        name: step.name,
        type: step.type,
        controlValues: "controlValues" in step ? step.controlValues : undefined,
      })),
    });

    const defaults = existing.preferences.default;
    const { email } = defaults.channels;
    const correctPreferences = !existing.preferences.user && defaults.all.enabled && defaults.all.readOnly
      && email?.enabled && Object.entries(defaults.channels).every(([channel, preference]) => channel === "email" || !preference.enabled);
    if (remoteFingerprint === desiredFingerprint && existing.active && correctPreferences) {
      result.unchanged.push(definition.workflowId);
      continue;
    }

    if (!options.dryRun) {
      const updatePayload: UpdateWorkflowDto = {
        name: definition.name,
        description: definition.description,
        tags: definition.tags,
        active: true,
        steps: mergeStepsForUpdate(definition.steps, existing.steps),
        preferences: defaultWorkflowPreferences(),
        origin: existing.origin ?? ResourceOriginEnum.NovuCloud,
      };
      await novu.workflows.update(updatePayload, existing.workflowId);
    }

    result.updated.push(definition.workflowId);
  }

  return result;
}

export function formatWorkflowApplyResult(result: ApplyWorkflowsResult): string {
  const lines = [
    `workflows: ${result.created.length} create, ${result.updated.length} update, ${result.unchanged.length} unchanged`,
  ];
  for (const workflowId of result.created) {
    lines.push(`  + ${workflowId}`);
  }
  for (const workflowId of result.updated) {
    lines.push(`  ~ ${workflowId}`);
  }
  return lines.join("\n");
}
