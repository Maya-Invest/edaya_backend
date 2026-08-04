import { describe, expect, it } from "bun:test";
import { IVORY_COAST_STRUCTURE_TEMPLATES } from "@edaya/fixtures/onboarding";
import {
  buildStructureBootstrapGraph,
  curriculumEntriesForLevel,
} from "@/lib/onboarding/apply-structure-template";

describe("buildStructureBootstrapGraph", () => {
  it("builds linked curriculum and class mirrors for a fixture level", async () => {
    const college = IVORY_COAST_STRUCTURE_TEMPLATES.find(template => template.id === "ci-college");
    expect(college).toBeTruthy();

    const levelDef = college!.gradeLevels.find(level => level.code === "4EME");
    expect(levelDef).toBeTruthy();

    const application = {
      repositories: {
        gradeLevels: { findById: async () => undefined },
        classGroups: { findById: async () => undefined },
      },
    };

    const graph = await buildStructureBootstrapGraph(
      application as never,
      "school-1",
      "year-1",
      [{
        gradeLevelId: levelDef!.id,
        classCount: 2,
        capacity: 30,
        template: college!,
        levelCode: "4EME",
      }],
    );

    const entries = curriculumEntriesForLevel(college!, "4EME");
    expect(graph.gradeLevels).toHaveLength(1);
    expect(graph.classGroups).toHaveLength(2);
    expect(graph.gradeLevelSubjects).toHaveLength(entries.length);
    expect(graph.classSubjects).toHaveLength(entries.length * 2);
    expect(graph.classSubjects.every(entry => entry.gradeLevelSubjectId)).toBe(true);
    expect(graph.classSubjectMatters.length).toBeGreaterThan(0);
    expect(graph.subjectCount).toBe(graph.subjects.length);
    expect(graph.classSubjectCount).toBe(entries.length * 2);

    for (const classSubject of graph.classSubjects) {
      const gls = graph.gradeLevelSubjects.find(entry => entry.id === classSubject.gradeLevelSubjectId);
      expect(gls).toBeTruthy();
      expect(classSubject.subjectId).toBe(gls!.subjectId);
      expect(classSubject.isOffered).toBe(!gls!.isOptional);
    }
  });
});
