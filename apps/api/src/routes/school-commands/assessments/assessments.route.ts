import type { CommandRoutePair } from "../types";
import { createGradeScaleHandler, createGradeScaleRoute } from "./create-grade-scale.route";
import { createReportCardDefinitionHandler, createReportCardDefinitionRoute } from "./create-report-card-definition.route";
import { createAssessmentHandler, createAssessmentRoute } from "./create-assessment.route";
import { completeAssessmentHandler, completeAssessmentRoute } from "./complete-assessment.route";
import { recordAssessmentResultHandler, recordAssessmentResultRoute } from "./record-assessment-result.route";
import { recordAssessmentResultComplianceHandler, recordAssessmentResultComplianceRoute } from "./record-assessment-result-compliance.route";
import { createReportCardDefinitionSectionHandler, createReportCardDefinitionSectionRoute } from "./create-report-card-definition-section.route";
import { generateReportCardResultHandler, generateReportCardResultRoute } from "./generate-report-card-result.route";
import { publishReportCardResultHandler, publishReportCardResultRoute } from "./publish-report-card-result.route";

export const assessmentsCommandRoutePairs: CommandRoutePair[] = [
  { route: createGradeScaleRoute, handler: createGradeScaleHandler },
  { route: createReportCardDefinitionRoute, handler: createReportCardDefinitionHandler },
  { route: createAssessmentRoute, handler: createAssessmentHandler },
  { route: completeAssessmentRoute, handler: completeAssessmentHandler },
  { route: recordAssessmentResultRoute, handler: recordAssessmentResultHandler },
  { route: recordAssessmentResultComplianceRoute, handler: recordAssessmentResultComplianceHandler },
  { route: createReportCardDefinitionSectionRoute, handler: createReportCardDefinitionSectionHandler },
  { route: generateReportCardResultRoute, handler: generateReportCardResultHandler },
  { route: publishReportCardResultRoute, handler: publishReportCardResultHandler },
];
