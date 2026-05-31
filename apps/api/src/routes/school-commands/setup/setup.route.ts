import type { CommandRoutePair } from "../types";
import { registerSchoolHandler, registerSchoolRoute } from "./register-school.route";
import { updateSchoolConfigurationHandler, updateSchoolConfigurationRoute } from "./update-school-configuration.route";
import { createAcademicYearHandler, createAcademicYearRoute } from "./create-academic-year.route";
import { activateAcademicYearHandler, activateAcademicYearRoute } from "./activate-academic-year.route";
import { publishAcademicPeriodHandler, publishAcademicPeriodRoute } from "./publish-academic-period.route";
import { createAcademicPeriodHandler, createAcademicPeriodRoute } from "./create-academic-period.route";
import { createClassGroupHandler, createClassGroupRoute } from "./create-class-group.route";
import { updateClassGroupConfigurationHandler, updateClassGroupConfigurationRoute } from "./update-class-group-configuration.route";
import { registerStaffMemberHandler, registerStaffMemberRoute } from "./register-staff-member.route";
import { updateStaffMemberStatusHandler, updateStaffMemberStatusRoute } from "./update-staff-member-status.route";
import { assignStaffToClassHandler, assignStaffToClassRoute } from "./assign-staff-to-class.route";
import { assignStaffToClassSubjectHandler, assignStaffToClassSubjectRoute } from "./assign-staff-to-class-subject.route";
import { assignStaffToSessionHandler, assignStaffToSessionRoute } from "./assign-staff-to-session.route";
import { assignResourceToClassHandler, assignResourceToClassRoute } from "./assign-resource-to-class.route";
import { assignResourceToSessionHandler, assignResourceToSessionRoute } from "./assign-resource-to-session.route";
import { removeResourceAssignmentHandler, removeResourceAssignmentRoute } from "./remove-resource-assignment.route";
import { registerAttachmentHandler, registerAttachmentRoute } from "./register-attachment.route";
import { removeAttachmentHandler, removeAttachmentRoute } from "./remove-attachment.route";

export const setupCommandRoutePairs: CommandRoutePair[] = [
  { route: registerSchoolRoute, handler: registerSchoolHandler },
  { route: updateSchoolConfigurationRoute, handler: updateSchoolConfigurationHandler },
  { route: createAcademicYearRoute, handler: createAcademicYearHandler },
  { route: activateAcademicYearRoute, handler: activateAcademicYearHandler },
  { route: publishAcademicPeriodRoute, handler: publishAcademicPeriodHandler },
  { route: createAcademicPeriodRoute, handler: createAcademicPeriodHandler },
  { route: createClassGroupRoute, handler: createClassGroupHandler },
  { route: updateClassGroupConfigurationRoute, handler: updateClassGroupConfigurationHandler },
  { route: registerStaffMemberRoute, handler: registerStaffMemberHandler },
  { route: updateStaffMemberStatusRoute, handler: updateStaffMemberStatusHandler },
  { route: assignStaffToClassRoute, handler: assignStaffToClassHandler },
  { route: assignStaffToClassSubjectRoute, handler: assignStaffToClassSubjectHandler },
  { route: assignStaffToSessionRoute, handler: assignStaffToSessionHandler },
  { route: assignResourceToClassRoute, handler: assignResourceToClassHandler },
  { route: assignResourceToSessionRoute, handler: assignResourceToSessionHandler },
  { route: removeResourceAssignmentRoute, handler: removeResourceAssignmentHandler },
  { route: registerAttachmentRoute, handler: registerAttachmentHandler },
  { route: removeAttachmentRoute, handler: removeAttachmentHandler },
];
