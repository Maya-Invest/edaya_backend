import type {
  BootstrapWorkflowDefinition,
  BootstrapWorkflowStep,
} from "./types";

type FingerprintStep = {
  stepId?: string;
  name: string;
  type: string;
  controlValues?: unknown;
};

export function normalizeWorkflowFingerprint(workflow: BootstrapWorkflowDefinition): string {
  const payload = {
    workflowId: workflow.workflowId,
    name: workflow.name,
    description: workflow.description,
    tags: [...workflow.tags].sort(),
    steps: workflow.steps.map(normalizeStep),
  };
  return stableStringify(payload);
}

function normalizeStep(step: BootstrapWorkflowStep): FingerprintStep {
  return {
    stepId: step.stepId,
    name: step.name,
    type: step.type,
    controlValues: step.controlValues ?? null,
  };
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortKeys(entry)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

export function normalizeRemoteWorkflowFingerprint(workflow: {
  workflowId: string;
  name: string;
  description?: string;
  tags?: string[];
  steps: Array<{
    stepId?: string;
    name: string;
    type: string;
    controlValues?: unknown;
  }>;
}): string {
  return stableStringify({
    workflowId: workflow.workflowId,
    name: workflow.name,
    description: workflow.description ?? "",
    tags: [...(workflow.tags ?? [])].sort(),
    steps: workflow.steps.map(step => ({
      stepId: step.stepId,
      name: step.name,
      type: step.type,
      controlValues: step.controlValues ?? null,
    })),
  });
}

export function normalizeIntegrationFingerprint(integration: {
  identifier: string;
  name: string;
  providerId: string;
  channel?: string;
  active: boolean;
  primary: boolean;
  credentials?: Record<string, unknown>;
}): string {
  return stableStringify({
    identifier: integration.identifier,
    name: integration.name,
    providerId: integration.providerId,
    channel: integration.channel ?? null,
    active: integration.active,
    primary: integration.primary,
    credentials: integration.credentials ?? null,
  });
}

export function normalizeRemoteIntegrationFingerprint(integration: {
  identifier: string;
  name: string;
  providerId: string;
  channel?: string;
  active: boolean;
  primary: boolean;
}): string {
  return stableStringify({
    identifier: integration.identifier,
    name: integration.name,
    providerId: integration.providerId,
    channel: integration.channel ?? null,
    active: integration.active,
    primary: integration.primary,
    credentials: null,
  });
}
