import type { CommandRoutePair } from "../types";
import { registerStudentHandler, registerStudentRoute } from "./register-student.route";
import { enrollStudentHandler, enrollStudentRoute } from "./enroll-student.route";
import { closeEnrollmentHandler, closeEnrollmentRoute } from "./close-enrollment.route";
import { recordProgressionDecisionHandler, recordProgressionDecisionRoute } from "./record-progression-decision.route";
import { promoteStudentHandler, promoteStudentRoute } from "./promote-student.route";
import { transferStudentHandler, transferStudentRoute } from "./transfer-student.route";
import { graduateStudentHandler, graduateStudentRoute } from "./graduate-student.route";
import { registerGuardianHandler, registerGuardianRoute } from "./register-guardian.route";
import { updateStudentProfileHandler, updateStudentProfileRoute } from "./update-student-profile.route";
import { updateStudentStatusHandler, updateStudentStatusRoute } from "./update-student-status.route";
import { upsertStudentHealthProfileHandler, upsertStudentHealthProfileRoute } from "./upsert-student-health-profile.route";
import { createStudentNoteHandler, createStudentNoteRoute } from "./create-student-note.route";
import { updateStudentNoteHandler, updateStudentNoteRoute } from "./update-student-note.route";
import { updateGuardianContactMethodsHandler, updateGuardianContactMethodsRoute } from "./update-guardian-contact-methods.route";
import { linkGuardianToStudentHandler, linkGuardianToStudentRoute } from "./link-guardian-to-student.route";
import { updateGuardianStudentLinkHandler, updateGuardianStudentLinkRoute } from "./update-guardian-student-link.route";

export const studentsCommandRoutePairs: CommandRoutePair[] = [
  { route: registerStudentRoute, handler: registerStudentHandler },
  { route: enrollStudentRoute, handler: enrollStudentHandler },
  { route: closeEnrollmentRoute, handler: closeEnrollmentHandler },
  { route: recordProgressionDecisionRoute, handler: recordProgressionDecisionHandler },
  { route: promoteStudentRoute, handler: promoteStudentHandler },
  { route: transferStudentRoute, handler: transferStudentHandler },
  { route: graduateStudentRoute, handler: graduateStudentHandler },
  { route: registerGuardianRoute, handler: registerGuardianHandler },
  { route: updateStudentProfileRoute, handler: updateStudentProfileHandler },
  { route: updateStudentStatusRoute, handler: updateStudentStatusHandler },
  { route: upsertStudentHealthProfileRoute, handler: upsertStudentHealthProfileHandler },
  { route: createStudentNoteRoute, handler: createStudentNoteHandler },
  { route: updateStudentNoteRoute, handler: updateStudentNoteHandler },
  { route: updateGuardianContactMethodsRoute, handler: updateGuardianContactMethodsHandler },
  { route: linkGuardianToStudentRoute, handler: linkGuardianToStudentHandler },
  { route: updateGuardianStudentLinkRoute, handler: updateGuardianStudentLinkHandler },
];
