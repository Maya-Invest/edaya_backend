import type {
  StructureTemplateDefinition,
  StructureTemplateId,
} from "./types";
import { FRANCE_STRUCTURE_TEMPLATES } from "./france";

export const BUILTIN_STRUCTURE_TEMPLATES: readonly StructureTemplateDefinition[] = [
  ...FRANCE_STRUCTURE_TEMPLATES,
];

const BUILTIN_BY_ID = new Map(
  BUILTIN_STRUCTURE_TEMPLATES.map(template => [template.id, template]),
);

export function isStructureTemplateId(value: string): value is StructureTemplateId {
  return value.startsWith("fr-") || value.startsWith("ci-");
}

export function resolveStructureTemplates(
  templateIds: StructureTemplateId[],
  snapshots: StructureTemplateDefinition[] = [],
): StructureTemplateDefinition[] {
  const snapshotById = new Map(snapshots.map(snapshot => [snapshot.id, snapshot]));

  return templateIds.map((templateId) => {
    const snapshot = snapshotById.get(templateId);
    if (snapshot) {
      return snapshot;
    }
    const builtin = BUILTIN_BY_ID.get(templateId);
    if (builtin) {
      return builtin;
    }
    throw new Error(`Unknown structure template: ${templateId}`);
  });
}

export function parseGradeLevelTemplateId(gradeLevelId: string): {
  templateId: StructureTemplateId;
  levelCode: string;
} | null {
  const separatorIndex = gradeLevelId.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }
  const templateId = gradeLevelId.slice(0, separatorIndex);
  const levelCode = gradeLevelId.slice(separatorIndex + 1);
  if (!isStructureTemplateId(templateId) || !levelCode) {
    return null;
  }
  return { templateId, levelCode };
}

export function classDisplayName(
  template: StructureTemplateDefinition,
  levelCode: string,
  index: number,
): string {
  const level = template.gradeLevels.find(entry => entry.code === levelCode);
  const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;
  const letter = letters[index] ?? String(index + 1);
  const shortLabel = level?.shortLabel ?? levelCode;
  return `${shortLabel} ${letter}`;
}
