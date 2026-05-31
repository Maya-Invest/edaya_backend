import type { CommandRoutePair } from "../types";
import { createScheduleHandler, createScheduleRoute } from "./create-schedule.route";
import { createCalendarEventHandler, createCalendarEventRoute } from "./create-calendar-event.route";
import { generateSessionsHandler, generateSessionsRoute } from "./generate-sessions.route";
import { createSessionHandler, createSessionRoute } from "./create-session.route";
import { recordAttendanceHandler, recordAttendanceRoute } from "./record-attendance.route";
import { recordDailyAttendanceHandler, recordDailyAttendanceRoute } from "./record-daily-attendance.route";
import { reviewAttendanceJustificationHandler, reviewAttendanceJustificationRoute } from "./review-attendance-justification.route";
import { recordSessionAttendanceHandler, recordSessionAttendanceRoute } from "./record-session-attendance.route";
import { recordClassDailyAttendanceHandler, recordClassDailyAttendanceRoute } from "./record-class-daily-attendance.route";

export const schedulingCommandRoutePairs: CommandRoutePair[] = [
  { route: createScheduleRoute, handler: createScheduleHandler },
  { route: createCalendarEventRoute, handler: createCalendarEventHandler },
  { route: generateSessionsRoute, handler: generateSessionsHandler },
  { route: createSessionRoute, handler: createSessionHandler },
  { route: recordAttendanceRoute, handler: recordAttendanceHandler },
  { route: recordDailyAttendanceRoute, handler: recordDailyAttendanceHandler },
  { route: reviewAttendanceJustificationRoute, handler: reviewAttendanceJustificationHandler },
  { route: recordSessionAttendanceRoute, handler: recordSessionAttendanceHandler },
  { route: recordClassDailyAttendanceRoute, handler: recordClassDailyAttendanceHandler },
];
