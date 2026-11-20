import { academicPeriodSchema, classSubjectSchema, manageStudentSubjectEnrollmentsSchema } from "@edaya/core";
import { z } from "@hono/zod-openapi";
import { enrollmentResponseSchema, subjectEnrollmentResponseSchema } from "./entities";
import { field, objectFromSchema } from "./helpers";
import { timetableEventSchema } from "./queries";

const selectionPeriodSchema = objectFromSchema(academicPeriodSchema).extend({ startDate: z.string().datetime(), endDate: z.string().datetime(), createdAt: z.string().datetime().optional() });

export const manageSubjectEnrollmentsCommandSchema = objectFromSchema(manageStudentSubjectEnrollmentsSchema).openapi("ManageStudentSubjectEnrollmentsCommand");
export const manageSubjectEnrollmentsResponseSchema = z.object({ enrollmentIds: z.array(field.id()), revisions: z.record(z.number().int()) }).openapi("ManageStudentSubjectEnrollmentsResponse");
export const studentSubjectEnrollmentsQuerySchema = z.object({ studentId: field.id(), academicYearId: field.id().optional() }).openapi("GetStudentSubjectEnrollmentsQuery");
export const studentSubjectEnrollmentsResponseSchema = z.object({
  studentId: field.id(),
  enrollments: z.array(subjectEnrollmentResponseSchema),
  placements: z.array(enrollmentResponseSchema),
  periods: z.array(selectionPeriodSchema),
  offerings: z.array(objectFromSchema(classSubjectSchema).extend({ name: z.string(), isOptional: z.boolean() })),
}).openapi("StudentSubjectEnrollmentsResponse");
export const classSubjectRosterQuerySchema = z.object({ classSubjectId: field.id(), at: field.date() }).openapi("GetClassSubjectRosterQuery");
export const classSubjectRosterResponseSchema = z.object({ classSubjectId: field.id(), at: field.date(), revision: z.number().int(), count: z.number().int().nullable(), basis: z.enum(["current_selection", "unavailable"]), periods: z.array(selectionPeriodSchema), students: z.array(z.object({ id: field.id(), firstName: z.string(), lastName: z.string() })), enrollments: z.array(subjectEnrollmentResponseSchema) }).openapi("ClassSubjectRosterResponse");
export const studentTimetableQuerySchema = z.object({ studentId: field.id(), startDate: field.date(), endDate: field.date() }).openapi("GetStudentTimetableQuery");
export const studentTimetableResponseSchema = z.object({ studentId: field.id(), startDate: z.string(), endDate: z.string(), events: z.array(timetableEventSchema) }).openapi("StudentTimetableResponse");
