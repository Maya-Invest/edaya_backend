import type { ResourceAccessScope } from './resource-access-scope'
import { z } from 'zod'
import { IncidentKind, IncidentStatus } from '../../domain/students/incident'

const id = z.string().min(1)
export const teacherIncidentsPageSize = 30
export const teacherIncidentsInput = z.object({ classGroupId: id, cursor: z.string().max(4096).optional() })
export const teacherIncidentDetailInput = z.object({ classGroupId: id, incidentId: id })
export const teacherIncidentItem = z.object({
  id,
  title: z.string(),
  description: z.string(),
  date: z.string().datetime(),
  kind: z.nativeEnum(IncidentKind),
  status: z.nativeEnum(IncidentStatus),
  locked: z.boolean(),
})
export const teacherIncidentsPage = z.object({ items: z.array(teacherIncidentItem), nextCursor: z.string().nullable() })
export type TeacherIncidentsInput = z.infer<typeof teacherIncidentsInput>
export type TeacherIncidentDetailInput = z.infer<typeof teacherIncidentDetailInput>
export type TeacherIncidentItem = z.infer<typeof teacherIncidentItem>
export interface TeacherIncidentsPort {
  list: (input: { read: ResourceAccessScope, edit: ResourceAccessScope, teacherId: string, classGroupId: string, after?: { date: string, id: string } }) => Promise<TeacherIncidentItem[]>
}
