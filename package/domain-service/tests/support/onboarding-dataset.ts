import type { OnboardingDataset } from '../../src/capabilities/onboarding/onboarding-dataset'

/** Small canonical dataset for orchestration, replay and rollback tests. */
export function createOnboardingTestDataset(): OnboardingDataset {
  return {
    id: 'test-secondary',
    version: '1.0.0',
    schemaVersion: 1,
    countryCode: 'CI',
    disciplines: [{ code: 'MATH', name: 'Mathématiques' }],
    subjectCategories: [{ code: 'SCI', name: 'Scientifique' }],
    gradeScales: [{ code: 'NUMERIC', name: 'Sur 20', minScore: 0, maxScore: 20, decimalPlaces: 2, roundingMode: 'nearest', intervalConvention: 'continuous', ranges: [{ code: 'LOW', label: 'Low', minScore: 0, maxScore: 10 }, { code: 'HIGH', label: 'High', minScore: 10, maxScore: 20 }] }],
    calendarProfiles: [{ code: 'TRIMESTERS', periodType: 'trimester', periods: [1, 2, 3].map(i => ({ code: `T${i}`, name: `Trimestre ${i}`, weight: 1 })) }],
    templates: [{
      id: 'ci-college',
      label: 'Collège',
      description: 'Test college',
      cycle: 'college',
      calendarProfileCode: 'TRIMESTERS',
      reportPresentation: { includeSummary: false, includeComments: true },
      gradeLevels: [{
        id: 'ci-college:4EME',
        code: '4EME',
        name: 'Quatrième',
        shortLabel: '4ème',
        order: 1,
        subjects: [{ code: 'MATH', name: 'Mathématiques', shortName: 'Maths', disciplineCode: 'MATH', categoryCode: 'SCI', coefficient: 4, isOptional: false, chapters: [{ code: 'ALG', title: 'Algèbre', order: 1 }], reportModuleCode: 'SCIENCE', reportOrder: 3 }],
        reportModules: [{ code: 'SCIENCE', name: 'Bilan Science', order: 1, weightingMode: 'subject_coefficients' }],
        gradingPolicy: { gradeScaleCode: 'NUMERIC', mode: 'numeric-first', aggregateLabel: 'Moyenne générale', passThreshold: 10 },
      }],
    }],
  }
}
