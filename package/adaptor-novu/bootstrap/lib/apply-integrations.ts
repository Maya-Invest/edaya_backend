import type { Novu } from "@novu/api";
import type { BootstrapIntegrationDefinition } from "./types";
import {
  normalizeIntegrationFingerprint,
  normalizeRemoteIntegrationFingerprint,
} from "./fingerprint";

export interface ApplyIntegrationsResult {
  created: string[];
  updated: string[];
  unchanged: string[];
  skipped: string[];
}

export async function applyBootstrapIntegrations(
  novu: Novu,
  definitions: readonly BootstrapIntegrationDefinition[],
  options: { dryRun?: boolean } = {},
): Promise<ApplyIntegrationsResult> {
  const result: ApplyIntegrationsResult = {
    created: [],
    updated: [],
    unchanged: [],
    skipped: [],
  };

  if (definitions.length === 0) {
    result.skipped.push("email-webhook (missing NOVU_EMAIL_WEBHOOK_URL/SECRET/FROM)");
    return result;
  }

  const response = await novu.integrations.list();
  const existing = response.result.filter(entry => !entry.deleted);
  const existingByIdentifier = new Map(existing.map(entry => [entry.identifier, entry]));

  for (const definition of definitions) {
    const metadataFingerprint = normalizeIntegrationFingerprint({
      identifier: definition.identifier,
      name: definition.name,
      providerId: definition.providerId,
      channel: definition.channel,
      active: definition.active,
      primary: definition.primary,
    });

    const current = existingByIdentifier.get(definition.identifier);
    if (!current?.id) {
      if (!options.dryRun) {
        const created = await novu.integrations.create({
          identifier: definition.identifier,
          name: definition.name,
          providerId: definition.providerId,
          channel: definition.channel,
          active: definition.active,
          credentials: definition.credentials,
        });
        if (definition.primary && created.result.id) {
          await novu.integrations.setAsPrimary(created.result.id);
        }
      }
      result.created.push(definition.identifier);
      continue;
    }

    const remoteMetadataFingerprint = normalizeRemoteIntegrationFingerprint(current);
    const metadataChanged = metadataFingerprint !== remoteMetadataFingerprint;

    if (!metadataChanged) {
      if (!options.dryRun) {
        await novu.integrations.update({
          name: definition.name,
          active: definition.active,
          credentials: definition.credentials,
        }, current.id);
        if (definition.primary && !current.primary) {
          await novu.integrations.setAsPrimary(current.id);
        }
      }
      result.unchanged.push(definition.identifier);
      continue;
    }

    if (!options.dryRun) {
      await novu.integrations.update({
        name: definition.name,
        active: definition.active,
        credentials: definition.credentials,
      }, current.id);
      if (definition.primary) {
        await novu.integrations.setAsPrimary(current.id);
      }
    }
    result.updated.push(definition.identifier);
  }

  return result;
}

export function formatIntegrationApplyResult(result: ApplyIntegrationsResult): string {
  const lines = [
    `integrations: ${result.created.length} create, ${result.updated.length} update, ${result.unchanged.length} unchanged`,
  ];
  for (const identifier of result.created) {
    lines.push(`  + ${identifier}`);
  }
  for (const identifier of result.updated) {
    lines.push(`  ~ ${identifier}`);
  }
  for (const note of result.skipped) {
    lines.push(`  - skipped ${note}`);
  }
  return lines.join("\n");
}
