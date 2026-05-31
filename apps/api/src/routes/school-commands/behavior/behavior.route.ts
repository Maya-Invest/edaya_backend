import type { CommandRoutePair } from "../types";
import { recordIncidentHandler, recordIncidentRoute } from "./record-incident.route";
import { addStudentInvolvementHandler, addStudentInvolvementRoute } from "./add-student-involvement.route";
import { applyDisciplinaryActionHandler, applyDisciplinaryActionRoute } from "./apply-disciplinary-action.route";
import { updateStudentDisciplinaryActionStatusHandler, updateStudentDisciplinaryActionStatusRoute } from "./update-student-disciplinary-action-status.route";
import { resolveIncidentHandler, resolveIncidentRoute } from "./resolve-incident.route";

export const behaviorCommandRoutePairs: CommandRoutePair[] = [
  { route: recordIncidentRoute, handler: recordIncidentHandler },
  { route: addStudentInvolvementRoute, handler: addStudentInvolvementHandler },
  { route: applyDisciplinaryActionRoute, handler: applyDisciplinaryActionHandler },
  { route: updateStudentDisciplinaryActionStatusRoute, handler: updateStudentDisciplinaryActionStatusHandler },
  { route: resolveIncidentRoute, handler: resolveIncidentHandler },
];
